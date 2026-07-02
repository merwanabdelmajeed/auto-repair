import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import { extractTenantClaims, UnauthorizedError, ForbiddenError } from '../../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, serverError } from '../../../shared/utils/response.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId, userId } = claims;
    const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    const { token } = body;
    if (!token || typeof token !== 'string') return badRequest('token is required');

    await db.send(new UpdateCommand({
      TableName: TABLE.USERS,
      Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
      UpdateExpression: 'SET expoPushToken = :token, updatedAt = :now',
      ExpressionAttributeValues: { ':token': token, ':now': new Date().toISOString() },
    }));

    return ok({ success: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    console.error(e);
    return serverError();
  }
};
