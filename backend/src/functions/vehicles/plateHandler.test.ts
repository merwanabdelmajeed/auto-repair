import type { APIGatewayProxyEvent } from 'aws-lambda';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './plateHandler';

function fakeEvent(role: string, query: Record<string, string> | null = { plate: 'ABC123', state: 'CA' }): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    queryStringParameters: query,
    requestContext: {
      authorizer: { claims: { sub: 'u1', email: 'u@shop.com', 'custom:tenantId': 't1', 'custom:role': role } },
    },
  } as unknown as APIGatewayProxyEvent;
}

describe('GET /vehicles/plate', () => {
  const fetchSpy = jest.spyOn(global, 'fetch');

  afterEach(() => fetchSpy.mockReset());

  it.each([UserRole.TENANT_OWNER, UserRole.LOCATION_MANAGER, UserRole.SUPER_ADMIN])(
    'rejects %s — the paid lookup is customer-only',
    async (role) => {
      const result = await handler(fakeEvent(role));
      expect(result.statusCode).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('validates the query for customers before any paid call', async () => {
    expect((await handler(fakeEvent(UserRole.CUSTOMER, null))).statusCode).toBe(400);
    expect((await handler(fakeEvent(UserRole.CUSTOMER, { plate: 'ABC123', state: 'CAL' }))).statusCode).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
