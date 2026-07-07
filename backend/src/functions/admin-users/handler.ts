import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand, UpdateCommand, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { db, TABLE, queryAll } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, conflict, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { UserRole } from '../../shared/types/index.js';

const OWNER_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER];
const ADMIN_ROLE_VALUES = new Set([UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER]);
const INVITABLE_ROLES = new Set([UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER]);

const cognito = new CognitoIdentityProviderClient({});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    requireRole(claims, ...OWNER_ROLES);
    const { tenantId } = claims;
    const method = event.httpMethod;
    const userId = event.pathParameters?.userId;
    const userPoolId = process.env.USER_POOL_ID;
    if (!userPoolId) {
      logger.error('USER_POOL_ID env var not set');
      return serverError();
    }

    // GET /admin-users
    if (method === 'GET' && !userId) {
      const items = await queryAll({
        TableName: TABLE.USERS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'USER#' },
      });
      const adminUsers = items
        .filter(i => ADMIN_ROLE_VALUES.has(i.role as UserRole))
        .map(toAdminUser);
      return ok(adminUsers);
    }

    // POST /admin-users — invite a new admin/location-manager
    if (method === 'POST') {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { email, firstName, lastName, role, locationIds } = body as {
        email?: string; firstName?: string; lastName?: string; role?: UserRole; locationIds?: string[];
      };

      if (!email) return badRequest('email is required');
      if (!role || !INVITABLE_ROLES.has(role)) {
        return badRequest('role must be TENANT_OWNER or LOCATION_MANAGER');
      }
      const locIds = locationIds ?? [];
      if (role === UserRole.LOCATION_MANAGER && locIds.length === 0) {
        return badRequest('locationIds is required for LOCATION_MANAGER invites');
      }
      if (locIds.length > 0) {
        const locations = await queryAll({
          TableName: TABLE.LOCATIONS,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
          ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'LOCATION#' },
        });
        const validIds = new Set(locations.map(l => l.locationId as string));
        if (!locIds.every(id => validIds.has(id))) {
          return badRequest('One or more locationIds do not belong to this tenant');
        }
      }

      let sub: string | undefined;
      try {
        const result = await cognito.send(new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: email,
          DesiredDeliveryMediums: ['EMAIL'],
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            ...(firstName ? [{ Name: 'given_name', Value: firstName }] : []),
            ...(lastName ? [{ Name: 'family_name', Value: lastName }] : []),
            { Name: 'custom:tenantId', Value: tenantId },
            { Name: 'custom:role', Value: role },
            { Name: 'custom:userType', Value: 'ADMIN' },
            { Name: 'custom:locationIds', Value: locIds.join(',') },
          ],
        }));
        sub = result.User?.Attributes?.find(a => a.Name === 'sub')?.Value;
      } catch (e) {
        if (e instanceof Error && e.name === 'UsernameExistsException') {
          return conflict('An account with this email already exists');
        }
        throw e;
      }
      if (!sub) {
        logger.error('AdminCreateUser succeeded but no sub was returned', { email, tenantId });
        return serverError();
      }

      const now = new Date().toISOString();
      const item: Record<string, unknown> = {
        PK: `TENANT#${tenantId}`,
        SK: `USER#${sub}`,
        GSI1PK: `TENANT#${tenantId}`,
        GSI1SK: `EMAIL#${email}`,
        userId: sub,
        tenantId,
        email,
        firstName: firstName ?? '',
        lastName: lastName ?? '',
        role,
        userType: 'ADMIN',
        locationIds: locIds,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      await db.send(new PutCommand({ TableName: TABLE.USERS, Item: item }));
      return created(toAdminUser(item));
    }

    // PATCH /admin-users/{userId} — update role/locations or activate/deactivate
    if (method === 'PATCH' && userId) {
      if (userId === claims.userId) return badRequest('You cannot modify your own account through this endpoint');

      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { role, locationIds, status } = body as { role?: UserRole; locationIds?: string[]; status?: 'ACTIVE' | 'INACTIVE' };

      if (role !== undefined && !INVITABLE_ROLES.has(role)) {
        return badRequest('role must be TENANT_OWNER or LOCATION_MANAGER');
      }
      if (status !== undefined && status !== 'ACTIVE' && status !== 'INACTIVE') {
        return badRequest('status must be ACTIVE or INACTIVE');
      }

      // Confirm the target belongs to this tenant and holds an admin-managed role
      // *before* any Cognito Admin* call — Cognito's Admin* APIs only require a
      // `sub` to exist somewhere in the (tenant-shared) User Pool, so without this
      // check a tenant owner could disable/re-role an admin from a different tenant
      // just by knowing their sub, before the tenant-scoped DynamoDB update below
      // ever runs.
      const existing = await db.send(new GetCommand({
        TableName: TABLE.USERS,
        Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
      }));
      const existingRole = existing.Item?.role as UserRole | undefined;
      if (!existing.Item || !existingRole || !INVITABLE_ROLES.has(existingRole)) {
        return notFound('Admin user not found');
      }

      if (status !== undefined) {
        await cognito.send(status === 'INACTIVE'
          ? new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: userId })
          : new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: userId }));
      }
      if (role !== undefined || locationIds !== undefined) {
        const attrs: { Name: string; Value: string }[] = [];
        if (role !== undefined) attrs.push({ Name: 'custom:role', Value: role });
        if (locationIds !== undefined) attrs.push({ Name: 'custom:locationIds', Value: locationIds.join(',') });
        await cognito.send(new AdminUpdateUserAttributesCommand({
          UserPoolId: userPoolId,
          Username: userId,
          UserAttributes: attrs,
        }));
      }

      const setParts: string[] = ['updatedAt = :now'];
      const values: Record<string, unknown> = { ':now': new Date().toISOString() };
      // DynamoDB's UpdateItem rejects the whole call with a ValidationException if
      // ExpressionAttributeNames declares a name that isn't actually referenced in
      // the UpdateExpression — so #role/#status must only be included when that
      // field is actually part of this update, not unconditionally.
      const names: Record<string, string> = {};
      if (role !== undefined) { setParts.push('#role = :role'); values[':role'] = role; names['#role'] = 'role'; }
      if (locationIds !== undefined) { setParts.push('locationIds = :locationIds'); values[':locationIds'] = locationIds; }
      if (status !== undefined) { setParts.push('#status = :status'); values[':status'] = status; names['#status'] = 'status'; }

      try {
        await db.send(new UpdateCommand({
          TableName: TABLE.USERS,
          Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
          UpdateExpression: `SET ${setParts.join(', ')}`,
          // DynamoDB also rejects an empty ExpressionAttributeNames object, so omit
          // the key entirely rather than passing `{}` when neither field is set.
          ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
          ExpressionAttributeValues: values,
          ConditionExpression: 'attribute_exists(PK)',
        }));
      } catch (e) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return notFound('Admin user not found');
        throw e;
      }
      return ok({ userId });
    }

    // DELETE /admin-users/{userId} — permanently remove a location manager or
    // tenant-owner account. Gated to OWNER_ROLES (SUPER_ADMIN/TENANT_OWNER) by the
    // requireRole() call at the top of this handler, so a LOCATION_MANAGER can
    // never reach this branch at all.
    if (method === 'DELETE' && userId) {
      if (userId === claims.userId) return badRequest('You cannot delete your own account through this endpoint');

      // Same tenant/role check as PATCH above, and for the same reason — must
      // happen before the Cognito call, not after, since Cognito's Admin* APIs
      // don't know or care about tenant boundaries in this shared User Pool.
      const existing = await db.send(new GetCommand({
        TableName: TABLE.USERS,
        Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
      }));
      const existingRole = existing.Item?.role as UserRole | undefined;
      if (!existing.Item || !existingRole || !INVITABLE_ROLES.has(existingRole)) {
        return notFound('Admin user not found');
      }

      try {
        await cognito.send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: userId }));
      } catch (e) {
        if (e instanceof Error && e.name === 'UserNotFoundException') return notFound('Admin user not found');
        throw e;
      }

      await db.send(new DeleteCommand({
        TableName: TABLE.USERS,
        Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
      }));

      return ok({ userId });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in admin-users handler', { error: e });
    return serverError();
  }
};

function toAdminUser(i: Record<string, unknown>) {
  return {
    userId: i.userId as string,
    email: i.email as string,
    firstName: (i.firstName as string) ?? '',
    lastName: (i.lastName as string) ?? '',
    role: i.role as UserRole,
    locationIds: (i.locationIds as string[]) ?? [],
    status: i.status as string,
    createdAt: i.createdAt as string,
  };
}
