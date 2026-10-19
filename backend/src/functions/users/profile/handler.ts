import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import { extractTenantClaims, UnauthorizedError, ForbiddenError } from '../../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { parseContactUpdate, updateExpression } from '../../../shared/utils/contactUpdate.js';

// GET/PUT /users/me — a signed-in user (customer or admin) reads or updates
// their own profile. The DynamoDB USERS record is the source of truth for the
// fields the admin-facing lists show (name, phone, address): the client also
// writes given_name/family_name to Cognito, but the phone is never synced back
// to Cognito (an admin can edit it too), so the app must read it from here.
// Scoped entirely to the caller's own claims: there is no target-user
// parameter, so this can never read or modify anyone else's record.
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId, userId } = claims;
    const key = { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` };

    if (event.httpMethod === 'GET') {
      const { Item } = await db.send(new GetCommand({ TableName: TABLE.USERS, Key: key }));
      if (!Item) return notFound('User not found');
      return ok({
        firstName: (Item.firstName as string) ?? '',
        lastName: (Item.lastName as string) ?? '',
        phone: (Item.phone as string) ?? null,
        address: (Item.address as Record<string, string>) ?? null,
      });
    }

    const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    if (!firstName || !lastName) return badRequest('firstName and lastName are required');

    // Phone and address are optional in the request (the admin app's own
    // name edit sends neither) — see parseContactUpdate for their rules.
    const contact = parseContactUpdate(body);
    if ('error' in contact) return badRequest(contact.error);

    try {
      await db.send(new UpdateCommand({
        TableName: TABLE.USERS,
        Key: key,
        // The record is created at signup (customer) or invite (admin); guard
        // against writing a partial ghost row if it's somehow missing.
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: updateExpression(
          ['firstName = :f', 'lastName = :l', 'updatedAt = :now', ...contact.sets],
          contact.removes,
        ),
        ExpressionAttributeValues: {
          ':f': firstName, ':l': lastName, ':now': new Date().toISOString(),
          ...contact.values,
        },
      }));
    } catch (e) {
      if ((e as { name?: string }).name === 'ConditionalCheckFailedException') return notFound('User not found');
      throw e;
    }

    return ok({ firstName, lastName, ...contact.result });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in user-profile handler', { error: e });
    return serverError();
  }
};
