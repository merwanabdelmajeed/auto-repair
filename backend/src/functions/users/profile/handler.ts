import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import { extractTenantClaims, UnauthorizedError, ForbiddenError } from '../../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

// PUT /users/me — a signed-in user (customer or admin) updates their own
// display name. The client also writes given_name/family_name to Cognito, but
// the DynamoDB USERS record is what the admin-facing lists read (Customers list
// and the admin-users team list), so it must be kept in sync here — otherwise
// those lists show the signup/invite-time name forever. Scoped entirely to the
// caller's own claims: there is no target-user parameter, so this can never
// modify anyone else's record.
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId, userId } = claims;
    const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    if (!firstName || !lastName) return badRequest('firstName and lastName are required');

    try {
      await db.send(new UpdateCommand({
        TableName: TABLE.USERS,
        Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
        // The record is created at signup (customer) or invite (admin); guard
        // against writing a partial ghost row if it's somehow missing.
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: 'SET firstName = :f, lastName = :l, updatedAt = :now',
        ExpressionAttributeValues: { ':f': firstName, ':l': lastName, ':now': new Date().toISOString() },
      }));
    } catch (e) {
      if ((e as { name?: string }).name === 'ConditionalCheckFailedException') return notFound('User not found');
      throw e;
    }

    return ok({ firstName, lastName });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in user-profile handler', { error: e });
    return serverError();
  }
};
