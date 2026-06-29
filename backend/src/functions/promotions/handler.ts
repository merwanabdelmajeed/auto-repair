import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand, PutCommand, UpdateCommand, DeleteCommand, GetCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, created, badRequest, notFound, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { UserRole, type Promotion } from '../../shared/types/index.js';

const ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER];

function toPromotion(i: Record<string, unknown>): Promotion {
  return {
    promoId: i.promoId as string,
    tenantId: i.tenantId as string,
    code: i.code as string,
    description: i.description as string,
    type: i.type as 'percent' | 'fixed',
    value: i.value as number,
    expiresAt: (i.expiresAt as string) ?? null,
    maxUses: (i.maxUses as number) ?? null,
    usedCount: (i.usedCount as number) ?? 0,
    isActive: i.isActive as boolean,
    createdAt: i.createdAt as string,
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { tenantId } = claims;
    const method = event.httpMethod;
    const promoId = event.pathParameters?.promoId;
    const isValidate = event.resource === '/promotions/validate' || promoId === 'validate';

    // GET /promotions/validate?code=XXX — any authenticated user
    if (method === 'GET' && isValidate) {
      const code = (event.queryStringParameters?.code ?? '').toUpperCase();
      if (!code) return badRequest('code query parameter is required');

      const result = await db.send(new QueryCommand({
        TableName: TABLE.PROMOTIONS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        FilterExpression: '#code = :code AND isActive = :true',
        ExpressionAttributeNames: { '#code': 'code' },
        ExpressionAttributeValues: { ':pk': `TENANT#${tenantId}`, ':skPrefix': 'PROMO#', ':code': code, ':true': true },
      }));

      const promo = result.Items?.[0];
      if (!promo) return notFound('Promo code not found or inactive');

      const p = toPromotion(promo);
      if (p.expiresAt && new Date(p.expiresAt) < new Date()) return badRequest('Promo code has expired');
      if (p.maxUses !== null && p.usedCount >= p.maxUses) return badRequest('Promo code has reached its usage limit');

      // Check if this customer has already used this code
      const usageCheck = await db.send(new GetCommand({
        TableName: TABLE.PROMOTIONS,
        Key: { PK: `TENANT#${tenantId}`, SK: `PROMO_USAGE#${p.promoId}#${claims.userId}` },
      }));
      if (usageCheck.Item) return badRequest('You have already used this promotion code');

      return ok({ promoId: p.promoId, code: p.code, description: p.description, type: p.type, value: p.value });
    }

    const pk = `TENANT#${tenantId}`;
    const isAdmin = ADMIN_ROLES.includes(claims.role);

    // GET /promotions — admins see all; customers see active/valid promos only
    if (method === 'GET' && !promoId) {
      const result = await db.send(new QueryCommand({
        TableName: TABLE.PROMOTIONS,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: { ':pk': pk, ':skPrefix': 'PROMO#' },
        ScanIndexForward: false,
      }));
      const all = (result.Items ?? []).map(toPromotion);
      if (isAdmin) return ok(all);

      // Customers: filter to active/valid promos only
      const now = new Date().toISOString();
      const validPromos = all.filter(
        p => p.isActive && (!p.expiresAt || p.expiresAt > now) && (p.maxUses === null || p.usedCount < p.maxUses),
      );

      // Filter out promos this customer has already used
      const customerId = claims.userId;
      if (validPromos.length > 0) {
        const usageKeys = validPromos.map(p => ({
          PK: pk,
          SK: `PROMO_USAGE#${p.promoId}#${customerId}`,
        }));
        const usageResult = await db.send(new BatchGetCommand({
          RequestItems: {
            [TABLE.PROMOTIONS]: { Keys: usageKeys, ProjectionExpression: 'SK' },
          },
        }));
        const usedSKs = new Set(
          (usageResult.Responses?.[TABLE.PROMOTIONS] ?? []).map(i => i.SK as string),
        );
        const unusedPromos = validPromos
          .filter(p => !usedSKs.has(`PROMO_USAGE#${p.promoId}#${customerId}`))
          .map(({ promoId, code, description, type, value, expiresAt }) => ({ promoId, code, description, type, value, expiresAt }));
        return ok(unusedPromos);
      }

      return ok([]);
    }

    // All write routes require admin
    requireRole(claims, ...ADMIN_ROLES);

    // POST /promotions — create
    if (method === 'POST' && !promoId) {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { code, description, type, value, expiresAt, maxUses } = body;
      if (!code || !type || value === undefined) return badRequest('code, type, and value are required');
      if (type !== 'percent' && type !== 'fixed') return badRequest('type must be percent or fixed');
      if (typeof value !== 'number' || value <= 0) return badRequest('value must be a positive number');
      if (type === 'percent' && (value as number) > 100) return badRequest('percent value cannot exceed 100');

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const item = {
        PK: pk, SK: `PROMO#${id}`,
        promoId: id, tenantId,
        code: (code as string).toUpperCase().trim(),
        description: (description as string) ?? '',
        type, value,
        expiresAt: expiresAt ?? null,
        maxUses: maxUses ?? null,
        usedCount: 0,
        isActive: true,
        createdAt: now,
      };
      await db.send(new PutCommand({ TableName: TABLE.PROMOTIONS, Item: item }));
      return created(toPromotion(item));
    }

    if (!promoId || promoId === 'validate') return badRequest('promoId required');

    // POST /promotions/{promoId}/apply — mark promo as used by a specific customer on an appointment
    const isApply = event.resource?.endsWith('/apply');
    if (method === 'POST' && isApply) {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const { customerId, appointmentId } = body;
      if (!customerId || !appointmentId) return badRequest('customerId and appointmentId are required');

      const usageSK = `PROMO_USAGE#${promoId}#${customerId}`;

      // Check if this customer has already had this promo applied
      const existing = await db.send(new GetCommand({
        TableName: TABLE.PROMOTIONS,
        Key: { PK: pk, SK: usageSK },
      }));

      if (existing.Item) {
        return badRequest(`This customer already had this promo applied on ${(existing.Item.appliedAt as string).slice(0, 10)}`);
      }

      const now = new Date().toISOString();

      // Record the usage and increment usedCount atomically
      await Promise.all([
        db.send(new PutCommand({
          TableName: TABLE.PROMOTIONS,
          Item: { PK: pk, SK: usageSK, promoId, customerId, appointmentId, appliedAt: now },
          ConditionExpression: 'attribute_not_exists(PK)',
        })),
        db.send(new UpdateCommand({
          TableName: TABLE.PROMOTIONS,
          Key: { PK: pk, SK: `PROMO#${promoId}` },
          UpdateExpression: 'SET usedCount = usedCount + :one',
          ExpressionAttributeValues: { ':one': 1 },
        })),
        db.send(new UpdateCommand({
          TableName: TABLE.APPOINTMENTS,
          Key: { PK: `TENANT#${tenantId}`, SK: `APPT#${appointmentId}` },
          UpdateExpression: 'SET promoApplied = :true, updatedAt = :now',
          ExpressionAttributeValues: { ':true': true, ':now': now },
        })),
      ]);

      return ok({ applied: true });
    }

    // PUT /promotions/{promoId} — update
    if (method === 'PUT') {
      const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
      const updates: string[] = [];
      const names: Record<string, string> = {};
      const vals: Record<string, unknown> = {};

      if (body.description !== undefined) { updates.push('#desc = :desc'); names['#desc'] = 'description'; vals[':desc'] = body.description; }
      if (body.isActive !== undefined) { updates.push('isActive = :active'); vals[':active'] = body.isActive; }
      if (body.expiresAt !== undefined) { updates.push('expiresAt = :exp'); vals[':exp'] = body.expiresAt; }
      if (body.maxUses !== undefined) { updates.push('maxUses = :mu'); vals[':mu'] = body.maxUses; }
      if (body.value !== undefined) { updates.push('#val = :val'); names['#val'] = 'value'; vals[':val'] = body.value; }
      if (body.type !== undefined) {
        if (body.type !== 'percent' && body.type !== 'fixed') return badRequest('type must be percent or fixed');
        updates.push('#type = :type'); names['#type'] = 'type'; vals[':type'] = body.type;
      }
      if (!updates.length) return badRequest('No fields to update');

      try {
        const result = await db.send(new UpdateCommand({
          TableName: TABLE.PROMOTIONS,
          Key: { PK: pk, SK: `PROMO#${promoId}` },
          UpdateExpression: `SET ${updates.join(', ')}`,
          ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
          ExpressionAttributeValues: vals,
          ConditionExpression: 'attribute_exists(PK)',
          ReturnValues: 'ALL_NEW',
        }));
        return ok(toPromotion(result.Attributes as Record<string, unknown>));
      } catch (e) {
        if (e instanceof Error && e.name === 'ConditionalCheckFailedException') return notFound('Promotion not found');
        throw e;
      }
    }

    // DELETE /promotions/{promoId}
    if (method === 'DELETE') {
      await db.send(new DeleteCommand({ TableName: TABLE.PROMOTIONS, Key: { PK: pk, SK: `PROMO#${promoId}` } }));
      return ok({ deleted: true });
    }

    return badRequest('Unknown route');
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    console.error(e);
    return serverError();
  }
};
