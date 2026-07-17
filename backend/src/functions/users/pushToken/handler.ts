import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import { extractTenantClaims, UnauthorizedError, ForbiddenError } from '../../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, serverError } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId, userId } = claims;
    const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    const { token } = body;
    if (!token || typeof token !== 'string') return badRequest('token is required');

    // ADD on a String Set is additive and idempotent — registering from a
    // second device (or re-registering the same one) doesn't overwrite any
    // other device's token, unlike a plain SET would.
    await db.send(new UpdateCommand({
      TableName: TABLE.USERS,
      Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
      UpdateExpression: 'ADD pushTokens :tokenSet SET updatedAt = :now',
      ExpressionAttributeValues: { ':tokenSet': new Set([token]), ':now': new Date().toISOString() },
    }));

    return ok({ success: true });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in push-token handler', { error: e });
    return serverError();
  }
};
