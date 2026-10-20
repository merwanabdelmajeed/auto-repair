import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { GetCommand, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import { extractTenantClaims, requireRole, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { UserRole } from '../../shared/types/index.js';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { ok, badRequest, unauthorized, forbidden, serverError, tooManyRequests, serviceUnavailable } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';

const CARAPI_TOKEN_PARAM = process.env.CARAPI_TOKEN_PARAM ?? '/autorepair/carapi-token';
const CARAPI_SECRET_PARAM = process.env.CARAPI_SECRET_PARAM ?? '/autorepair/carapi-secret';
const ssm = new SSMClient({});

// Every CarAPI plate lookup is billed, so paid calls are guarded:
//   1. results are cached per tenant (a repeat lookup of the same plate is free)
//   2. each customer gets USER_DAILY_LIMIT paid lookups per UTC day
//   3. each tenant gets TENANT_DAILY_LIMIT paid lookups per UTC day — a hard
//      ceiling on spend no matter how many customers there are
// (API Gateway also throttles this route — see template.yaml.)
const USER_DAILY_LIMIT = Number(process.env.PLATE_LOOKUP_USER_DAILY_LIMIT ?? 3);
const TENANT_DAILY_LIMIT = Number(process.env.PLATE_LOOKUP_TENANT_DAILY_LIMIT ?? 50);
const DAY_SECONDS = 24 * 60 * 60;
const FOUND_CACHE_DAYS = 365;   // a plate→VIN match rarely changes
const NOT_FOUND_CACHE_DAYS = 7; // a plate may be registered later
const PLATE_PATTERN = /^[A-Z0-9]{1,8}$/;

let cachedCreds: { token: string; secret: string } | null = null;
let cachedJwt: string | null = null;

async function getCredentials(): Promise<{ token: string; secret: string }> {
  if (cachedCreds) return cachedCreds;
  const [tokenRes, secretRes] = await Promise.all([
    ssm.send(new GetParameterCommand({ Name: CARAPI_TOKEN_PARAM, WithDecryption: true })),
    ssm.send(new GetParameterCommand({ Name: CARAPI_SECRET_PARAM, WithDecryption: true })),
  ]);
  cachedCreds = {
    token: tokenRes.Parameter?.Value ?? '',
    secret: secretRes.Parameter?.Value ?? '',
  };
  return cachedCreds;
}

function jwtExpiringSoon(jwt: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString('utf8')) as { exp?: number };
    if (!payload.exp) return true;
    return Date.now() >= payload.exp * 1000 - 60_000; // refresh 1 min before expiry
  } catch {
    return true;
  }
}

async function getJwt(): Promise<string> {
  if (cachedJwt && !jwtExpiringSoon(cachedJwt)) return cachedJwt;
  const { token, secret } = await getCredentials();
  const res = await fetch('https://carapi.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_token: token, api_secret: secret }),
  });
  if (!res.ok) {
    logger.error('CarAPI login failed', { status: res.status, body: await res.text() });
    throw new Error('CarAPI authentication failed');
  }
  cachedJwt = (await res.text()).trim();
  return cachedJwt;
}

interface NhtsaResult {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Trim?: string;
  ErrorCode?: string;
}

interface VehicleDetails { make: string; model: string; year: string; trim?: string }

type PlateResult = { status: 'found'; vin: string } | { status: 'not-found' } | { status: 'error' };

async function plateToVin(plate: string, state: string): Promise<PlateResult> {
  const jwt = await getJwt();
  const url = `https://carapi.app/api/license-plate?country_code=US&region=${encodeURIComponent(state)}&lookup=${encodeURIComponent(plate)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (res.status === 404) return { status: 'not-found' };
  if (!res.ok) {
    logger.error('CarAPI plate lookup failed', { status: res.status, body: await res.text(), state });
    return { status: 'error' };
  }
  const data = await res.json() as { vin?: string | null };
  return data.vin ? { status: 'found', vin: data.vin } : { status: 'not-found' };
}

async function decodeVin(vin: string): Promise<VehicleDetails | null> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) {
    logger.error('NHTSA decode failed', { status: res.status, body: await res.text(), vin });
    return null;
  }
  const data = await res.json() as { Results?: NhtsaResult[] };
  const r = data.Results?.[0];
  if (!r?.Make || !r?.Model || !r?.ModelYear || r.ErrorCode === '8') return null;
  return { make: r.Make, model: r.Model, year: r.ModelYear, trim: r.Trim || undefined };
}

// ── Cache ──────────────────────────────────────────────────────────────────
interface CacheEntry { notFound?: boolean; vin?: string; details?: VehicleDetails }

const cacheKey = (tenantId: string, state: string, plate: string) =>
  ({ PK: `TENANT#${tenantId}`, SK: `PLATE#${state}#${plate}` });

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function readCache(tenantId: string, state: string, plate: string): Promise<CacheEntry | null> {
  const { Item } = await db.send(new GetCommand({ TableName: TABLE.PLATE_LOOKUPS, Key: cacheKey(tenantId, state, plate) }));
  // DynamoDB's TTL sweep can lag, so honor expiresAt ourselves.
  if (!Item || (Item.expiresAt as number) <= nowSeconds()) return null;
  return { notFound: Item.notFound as boolean | undefined, vin: Item.vin as string | undefined, details: Item.details as VehicleDetails | undefined };
}

async function writeCache(tenantId: string, state: string, plate: string, entry: CacheEntry, days: number): Promise<void> {
  try {
    await db.send(new PutCommand({
      TableName: TABLE.PLATE_LOOKUPS,
      Item: { ...cacheKey(tenantId, state, plate), ...entry, expiresAt: nowSeconds() + days * DAY_SECONDS },
    }));
  } catch (e) {
    // The paid lookup already succeeded — don't fail the request over the cache.
    logger.error('Failed to cache plate lookup', { error: e });
  }
}

// ── Daily quotas ───────────────────────────────────────────────────────────
// Both counters are incremented in one transaction, each conditioned on being
// under its limit, so a lookup is only paid for when BOTH have room.
async function reserveLookup(tenantId: string, userId: string): Promise<'ok' | 'user-limit' | 'tenant-limit'> {
  const day = new Date().toISOString().slice(0, 10);
  const expiresAt = nowSeconds() + 2 * DAY_SECONDS;
  const counter = (sk: string, limit: number) => ({
    Update: {
      TableName: TABLE.PLATE_LOOKUPS,
      Key: { PK: `TENANT#${tenantId}`, SK: sk },
      UpdateExpression: 'ADD #count :one SET expiresAt = :exp',
      ConditionExpression: 'attribute_not_exists(#count) OR #count < :limit',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: { ':one': 1, ':exp': expiresAt, ':limit': limit },
    },
  });
  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        counter(`USAGE#${day}#USER#${userId}`, USER_DAILY_LIMIT),
        counter(`USAGE#${day}`, TENANT_DAILY_LIMIT),
      ],
    }));
    return 'ok';
  } catch (e) {
    if (e instanceof TransactionCanceledException || (e as Error)?.name === 'TransactionCanceledException') {
      const reasons = (e as TransactionCanceledException).CancellationReasons ?? [];
      return reasons[0]?.Code === 'ConditionalCheckFailed' ? 'user-limit' : 'tenant-limit';
    }
    throw e;
  }
}

const NOT_FOUND_MESSAGE = 'Could not find a VIN for that plate and state';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Each lookup is a paid CarAPI call — customers only. Admins add vehicles
    // by VIN, which is decoded for free via NHTSA.
    const claims = extractTenantClaims(event);
    requireRole(claims, UserRole.CUSTOMER);

    const plate = event.queryStringParameters?.plate?.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const state = event.queryStringParameters?.state?.trim().toUpperCase();

    if (!plate || !state) return badRequest('plate and state query params are required');
    if (!/^[A-Z]{2}$/.test(state)) return badRequest('state must be a 2-letter abbreviation');
    // Reject obvious junk before it can cost anything.
    if (!PLATE_PATTERN.test(plate)) return badRequest('License plates are 1–8 letters and numbers');

    const cached = await readCache(claims.tenantId, state, plate);
    let vin = cached?.vin;
    let details = cached?.details;
    if (cached?.notFound) return badRequest(NOT_FOUND_MESSAGE);

    if (!vin) {
      const reservation = await reserveLookup(claims.tenantId, claims.userId);
      if (reservation === 'user-limit') {
        return tooManyRequests(`You've used today's ${USER_DAILY_LIMIT} plate lookups. Enter the VIN instead, or try again tomorrow.`);
      }
      if (reservation === 'tenant-limit') {
        logger.warn('Tenant plate-lookup daily cap reached', { tenantId: claims.tenantId, limit: TENANT_DAILY_LIMIT });
        return tooManyRequests('Plate lookup is unavailable for the rest of today. Enter the VIN instead.');
      }

      const result = await plateToVin(plate, state);
      if (result.status === 'error') return serviceUnavailable('Plate lookup is temporarily unavailable. Enter the VIN instead, or try again later.');
      if (result.status === 'not-found') {
        await writeCache(claims.tenantId, state, plate, { notFound: true }, NOT_FOUND_CACHE_DAYS);
        return badRequest(NOT_FOUND_MESSAGE);
      }
      vin = result.vin;
    }

    if (!details) {
      // NHTSA is free; if it's down, cache the paid VIN anyway so a retry
      // doesn't pay CarAPI again.
      details = (await decodeVin(vin)) ?? undefined;
      await writeCache(claims.tenantId, state, plate, details ? { vin, details } : { vin }, FOUND_CACHE_DAYS);
      if (!details) return badRequest('VIN found but vehicle details could not be decoded');
    }

    return ok({ vin, ...details });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in plate lookup handler', { error: e });
    return serverError();
  }
};
