import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { extractTenantClaims, UnauthorizedError, ForbiddenError } from '../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, forbidden, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';

const CARAPI_TOKEN_PARAM = process.env.CARAPI_TOKEN_PARAM ?? '/autorepair/carapi-token';
const CARAPI_SECRET_PARAM = process.env.CARAPI_SECRET_PARAM ?? '/autorepair/carapi-secret';
const ssm = new SSMClient({});

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

async function plateToVin(plate: string, state: string): Promise<string | null> {
  const jwt = await getJwt();
  const url = `https://carapi.app/api/license-plate?country_code=US&region=${encodeURIComponent(state)}&lookup=${encodeURIComponent(plate)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    logger.error('CarAPI plate lookup failed', { status: res.status, body: await res.text(), state });
    return null;
  }
  const data = await res.json() as { vin?: string | null };
  return data.vin ?? null;
}

async function decodeVin(vin: string): Promise<{ make: string; model: string; year: string; trim?: string } | null> {
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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    extractTenantClaims(event);

    const plate = event.queryStringParameters?.plate?.trim().toUpperCase();
    const state = event.queryStringParameters?.state?.trim().toUpperCase();

    if (!plate || !state) return badRequest('plate and state query params are required');
    if (state.length !== 2) return badRequest('state must be a 2-letter abbreviation');

    const vin = await plateToVin(plate, state);
    if (!vin) return badRequest('Could not find a VIN for that plate and state');

    const details = await decodeVin(vin);
    if (!details) return badRequest('VIN found but vehicle details could not be decoded');

    return ok({ vin, ...details });
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized(e.message);
    if (e instanceof ForbiddenError) return forbidden(e.message);
    logger.error('Unhandled error in plate lookup handler', { error: e });
    return serverError();
  }
};
