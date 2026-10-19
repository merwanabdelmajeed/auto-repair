import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

function fakeEvent(overrides: Partial<APIGatewayProxyEvent> & { claims?: Record<string, string> } = {}): APIGatewayProxyEvent {
  const { claims, ...rest } = overrides;
  return {
    httpMethod: 'GET',
    body: null,
    pathParameters: null,
    queryStringParameters: null,
    requestContext: {
      authorizer: {
        claims: {
          sub: 'customer-1',
          email: 'customer@shop.com',
          'custom:tenantId': 't1',
          'custom:role': UserRole.CUSTOMER,
          ...(claims ?? {}),
        },
      },
    },
    ...rest,
  } as unknown as APIGatewayProxyEvent;
}

describe('GET /vehicles', () => {
  it('scopes customers to their own vehicles via GSI1', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ vehicleId: 'v1', tenantId: 't1', customerId: 'customer-1', make: 'Honda', model: 'Civic', year: 2020, color: 'blue', createdAt: 'c', updatedAt: 'u' }],
    });
    const result = await handler(fakeEvent());
    expect(result.statusCode).toBe(200);
    const call = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(call?.IndexName).toBe('GSI1');
    expect(call?.ExpressionAttributeValues).toMatchObject({ ':gsi1pk': 'CUSTOMER#customer-1' });
  });

  it('gives admins the full paginated tenant vehicle list', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ vehicleId: 'v1', tenantId: 't1', customerId: 'c1', make: 'Honda', model: 'Civic', year: 2020, color: 'blue', createdAt: 'c', updatedAt: 'u' }],
    });
    const result = await handler(fakeEvent({ claims: { 'custom:role': UserRole.TENANT_OWNER } }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data.items).toHaveLength(1);
  });
});

describe('POST /vehicles', () => {
  function postEvent(body: Record<string, unknown>, claims?: Record<string, string>) {
    return fakeEvent({ httpMethod: 'POST', body: JSON.stringify(body), claims });
  }

  it('ignores a customerId sent by a customer — always their own vehicle', async () => {
    ddbMock.on(PutCommand).resolves({});
    await handler(postEvent({ make: 'Honda', model: 'Civic', year: 2020, color: 'blue', customerId: 'someone-else' }));
    const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item;
    expect(item).toMatchObject({ customerId: 'customer-1', GSI1PK: 'CUSTOMER#customer-1' });
  });

  describe('as an admin, for a customer', () => {
    const admin = { 'custom:role': UserRole.TENANT_OWNER, sub: 'owner-1' };
    const car = { make: 'HONDA', model: 'Accord', year: 2003, color: 'Silver', vin: '1HGCM82633A004352' };

    it('creates the vehicle under the customer, scoped to the admin tenant', async () => {
      ddbMock.on(GetCommand).resolves({ Item: { role: 'CUSTOMER' } });
      ddbMock.on(PutCommand).resolves({});

      const result = await handler(postEvent({ ...car, customerId: 'c9' }, admin));

      expect(result.statusCode).toBe(201);
      expect(ddbMock.commandCalls(GetCommand)[0]?.args[0].input.Key).toEqual({ PK: 'TENANT#t1', SK: 'USER#c9' });
      const item = ddbMock.commandCalls(PutCommand)[0]?.args[0].input.Item;
      expect(item).toMatchObject({ PK: 'TENANT#t1', customerId: 'c9', GSI1PK: 'CUSTOMER#c9', vin: car.vin });
    });

    it('requires a customerId and a VIN', async () => {
      expect((await handler(postEvent(car, admin))).statusCode).toBe(400);
      expect((await handler(postEvent({ ...car, vin: ' ', customerId: 'c9' }, admin))).statusCode).toBe(400);
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    });

    it('returns 404 for an unknown customer or a non-customer user', async () => {
      ddbMock.on(GetCommand).resolvesOnce({}).resolvesOnce({ Item: { role: 'TENANT_OWNER' } });

      expect((await handler(postEvent({ ...car, customerId: 'nope' }, admin))).statusCode).toBe(404);
      expect((await handler(postEvent({ ...car, customerId: 'owner-2' }, admin))).statusCode).toBe(404);
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    });

    it('still requires make, model, year and color', async () => {
      ddbMock.on(GetCommand).resolves({ Item: { role: 'CUSTOMER' } });
      const result = await handler(postEvent({ vin: car.vin, customerId: 'c9' }, admin));
      expect(result.statusCode).toBe(400);
    });
  });

  it('rejects missing required fields', async () => {
    const result = await handler(postEvent({ make: 'Honda' }));
    expect(result.statusCode).toBe(400);
  });

  it('creates a vehicle, omitting optional fields when absent', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(postEvent({ make: 'Honda', model: 'Civic', year: 2020, color: 'blue' }));
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body).data;
    expect(body.licensePlate).toBeNull();
    expect(body.vin).toBeNull();
    expect(body.trim).toBeNull();
  });

  it('creates a vehicle including optional fields when provided', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(postEvent({ make: 'Honda', model: 'Civic', trim: 'EX', year: 2020, color: 'blue', licensePlate: 'ABC123', vin: '1HGCM82633A123456' }));
    const body = JSON.parse(result.body).data;
    expect(body).toMatchObject({ licensePlate: 'ABC123', vin: '1HGCM82633A123456', trim: 'EX' });
  });
});

describe('PUT /vehicles/{vehicleId}', () => {
  it('rejects non-admins', async () => {
    const result = await handler(fakeEvent({ httpMethod: 'PUT', pathParameters: { vehicleId: 'v1' }, body: '{}' }));
    expect(result.statusCode).toBe(403);
  });

  it('updates licensePlate/vin for admins', async () => {
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { vehicleId: 'v1', tenantId: 't1', customerId: 'c1', make: 'Honda', model: 'Civic', year: 2020, color: 'blue', licensePlate: 'XYZ999', createdAt: 'c', updatedAt: 'u' },
    });
    const result = await handler(fakeEvent({
      httpMethod: 'PUT', pathParameters: { vehicleId: 'v1' }, body: JSON.stringify({ licensePlate: 'XYZ999' }),
      claims: { 'custom:role': UserRole.TENANT_OWNER },
    }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data.licensePlate).toBe('XYZ999');
  });

  it('ignores year/make/model/trim — only plate and VIN are editable', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: {} });
    await handler(fakeEvent({
      httpMethod: 'PUT', pathParameters: { vehicleId: 'v1' },
      body: JSON.stringify({ licensePlate: 'A', vin: 'B', year: 2019, make: 'TOYOTA', model: 'Camry' }),
      claims: { 'custom:role': UserRole.TENANT_OWNER },
    }));
    const input = ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input;
    expect(input?.UpdateExpression).toBe('SET licensePlate = :lp, vin = :vin, updatedAt = :now');
    expect(input?.ExpressionAttributeValues).not.toHaveProperty(':make');
  });

  it('returns 404 when the vehicle does not exist', async () => {
    ddbMock.on(UpdateCommand).rejects(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
    const result = await handler(fakeEvent({
      httpMethod: 'PUT', pathParameters: { vehicleId: 'v1' }, body: '{}',
      claims: { 'custom:role': UserRole.TENANT_OWNER },
    }));
    expect(result.statusCode).toBe(404);
  });
});

describe('DELETE /vehicles/{vehicleId}', () => {
  it('deletes a vehicle', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler(fakeEvent({ httpMethod: 'DELETE', pathParameters: { vehicleId: 'v1' } }));
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ vehicleId: 'v1' });
  });
});

it('returns 400 for an unknown route', async () => {
  const result = await handler(fakeEvent({ httpMethod: 'PATCH' as never }));
  expect(result.statusCode).toBe(400);
});
