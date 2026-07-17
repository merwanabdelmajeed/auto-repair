import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { db, TABLE, queryPage, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, paginated, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

const cognito = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.httpMethod;

    // DELETE /customers/me — self-service account deletion (Apple guideline
    // 5.1.1(v): an email-request page isn't sufficient, this must be a real
    // in-app action). Scoped entirely to the caller's own verified claims —
    // there is no target-user parameter, so this can never delete anyone
    // else's account.
    if (method === 'DELETE') {
      const claims = extractTenantClaims(event);
      requireRole(claims, UserRole.CUSTOMER);
      const { tenantId, userId } = claims;

      const [vehicles, appointments, notifications] = await Promise.all([
        queryAll({
          TableName: TABLE.VEHICLES,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: { ':gsi1pk': `CUSTOMER#${userId}` },
        }),
        queryAll({
          TableName: TABLE.APPOINTMENTS,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: { ':gsi1pk': `CUSTOMER#${userId}` },
        }),
        queryAll({
          TableName: TABLE.NOTIFICATIONS,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': `USER#${userId}` },
        }),
      ]);

      await Promise.all([
        ...vehicles.map(v => db.send(new DeleteCommand({
          TableName: TABLE.VEHICLES,
          Key: { PK: v.PK as string, SK: v.SK as string },
        }))),
        ...appointments.map(a => db.send(new DeleteCommand({
          TableName: TABLE.APPOINTMENTS,
          Key: { PK: a.PK as string, SK: a.SK as string },
        }))),
        ...notifications.map(n => db.send(new DeleteCommand({
          TableName: TABLE.NOTIFICATIONS,
          Key: { PK: n.PK as string, SK: n.SK as string },
        }))),
        db.send(new DeleteCommand({
          TableName: TABLE.USERS,
          Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
        })),
      ]);

      const userPoolId = process.env.USER_POOL_ID;
      if (!userPoolId) {
        logger.error('USER_POOL_ID env var not set');
        return serverError();
      }
      await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: userId }));

      return ok({ deleted: true });
    }

    const claims = extractTenantClaims(event);
    requireRole(claims, UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER);

    const { tenantId } = claims;
    const cursor = event.queryStringParameters?.cursor ?? null;
    const limit = Math.min(Number(event.queryStringParameters?.limit ?? 25) || 25, 100);

    const { items, nextCursor } = await queryPage({
      TableName: TABLE.USERS,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      // Admin/location-manager users now have real USER# records too (Phase 9
      // invite flow) — without this filter they'd show up in the Customers list.
      FilterExpression: '#role = :customer',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'USER#', ':customer': 'CUSTOMER' },
      limit,
      cursor,
    });

    const customers = items.map(i => ({
      userId: i.userId as string,
      email: i.email as string,
      firstName: (i.firstName as string) ?? '',
      lastName: (i.lastName as string) ?? '',
      phone: (i.phone as string) ?? null,
      status: i.status as string,
      createdAt: i.createdAt as string,
    }));

    return paginated(customers, nextCursor);
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in customers handler', { error: e });
    return serverError();
  }
};
