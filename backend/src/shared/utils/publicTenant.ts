import type { APIGatewayProxyEvent } from 'aws-lambda';

// Public GET routes (Auth: Authorizer NONE in template.yaml — /services,
// /capacity) never run the Cognito authorizer, so event.requestContext.
// authorizer.claims is never populated — even for admin-portal/admin-app
// callers sending a real, valid token. These routes' data is meant to be
// publicly readable anyway — it's reachable via ?tenantId= with zero auth by
// design — so decoding (without re-verifying) a bearer token's payload to pull
// tenantId doesn't expose anything that isn't already exposed by the guest path.
export function tenantIdFromUnverifiedBearerToken(event: APIGatewayProxyEvent): string | undefined {
  const header = event.headers?.Authorization ?? event.headers?.authorization;
  if (!header) return undefined;
  const token = header.replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return (JSON.parse(json) as Record<string, string>)['custom:tenantId'];
  } catch {
    return undefined;
  }
}

// The caller's own tenant (from a bearer token, if any), else ?tenantId= for
// guest browsing.
export function publicTenantId(event: APIGatewayProxyEvent): string | undefined {
  return tenantIdFromUnverifiedBearerToken(event) ?? event.queryStringParameters?.tenantId;
}
