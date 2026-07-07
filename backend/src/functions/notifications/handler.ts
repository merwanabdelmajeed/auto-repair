import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { userId } = claims;
    const method = event.httpMethod;
    const notifId = event.pathParameters?.notifId;

    // GET /notifications
    if (method === 'GET' && !notifId) {
      const result = await db.send(new QueryCommand({
        TableName: TABLE.NOTIFICATIONS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'NOTIF#' },
        ScanIndexForward: false,
        Limit: 50,
      }));
      return ok((result.Items ?? []).map(toNotification));
    }

    // PUT /notifications/read-all — scoped to the caller's own USER# partition,
    // so an admin marking their notifications read never touches other admins'.
    if (method === 'PUT' && !notifId && event.path.endsWith('/read-all')) {
      const unread = await queryAll({
        TableName: TABLE.NOTIFICATIONS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: '#r = :false',
        ExpressionAttributeNames: { '#r': 'read' },
        ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'NOTIF#', ':false': false },
      });
      await Promise.all(unread.map(item => db.send(new UpdateCommand({
        TableName: TABLE.NOTIFICATIONS,
        Key: { PK: item.PK as string, SK: item.SK as string },
        UpdateExpression: 'SET #r = :true',
        ExpressionAttributeNames: { '#r': 'read' },
        ExpressionAttributeValues: { ':true': true },
      }))));
      return ok({ updated: unread.length });
    }

    // PUT /notifications/{notifId}/read
    if (method === 'PUT' && notifId) {
      // Limit is intentionally omitted — it applies before FilterExpression and would miss most items
      const found = await db.send(new QueryCommand({
        TableName: TABLE.NOTIFICATIONS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'notifId = :nid',
        ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'NOTIF#', ':nid': notifId },
      }));
      const item = found.Items?.[0];
      if (!item) return badRequest('Notification not found');
      await db.send(new UpdateCommand({
        TableName: TABLE.NOTIFICATIONS,
        Key: { PK: item.PK as string, SK: item.SK as string },
        UpdateExpression: 'SET #r = :true',
        ExpressionAttributeNames: { '#r': 'read' },
        ExpressionAttributeValues: { ':true': true },
      }));
      return ok({ notifId });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in notifications handler', { error: e });
    return serverError();
  }
};

function toNotification(i: Record<string, unknown>) {
  return {
    notifId: i.notifId,
    type: i.type,
    title: i.title,
    body: i.body,
    read: i.read ?? false,
    createdAt: i.createdAt,
    appointmentId: i.appointmentId ?? null,
    promoId: i.promoId ?? null,
  };
}
