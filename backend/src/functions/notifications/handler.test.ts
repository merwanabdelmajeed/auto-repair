import type { APIGatewayProxyEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { UserRole } from '../../shared/types/index.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

function fakeEvent(overrides: Partial<APIGatewayProxyEvent> & { claims?: Record<string, string> }): APIGatewayProxyEvent {
  const { claims, ...rest } = overrides;
  return {
    httpMethod: 'GET',
    path: '/notifications',
    body: null,
    pathParameters: null,
    requestContext: {
      authorizer: {
        claims: {
          sub: 'admin-1',
          email: 'admin@shop.com',
          'custom:tenantId': 't1',
          'custom:role': UserRole.TENANT_OWNER,
          ...(claims ?? {}),
        },
      },
    },
    ...rest,
  } as unknown as APIGatewayProxyEvent;
}

describe('GET /notifications', () => {
  it('scopes the query to the caller\'s own USER# partition', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ notifId: 'n1', read: false, createdAt: 't' }] });

    const result = await handler(fakeEvent({ httpMethod: 'GET', path: '/notifications' }));

    expect(result.statusCode).toBe(200);
    const queryInput = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(queryInput?.ExpressionAttributeValues).toMatchObject({ ':pk': 'USER#admin-1' });
    expect(JSON.parse(result.body).data).toHaveLength(1);
  });
});

describe('PUT /notifications/{notifId}/read', () => {
  it('marks only the matching notification as read', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ PK: 'USER#admin-1', SK: 'NOTIF#1#n1', notifId: 'n1' }] });
    ddbMock.on(UpdateCommand).resolves({});

    const result = await handler(fakeEvent({
      httpMethod: 'PUT',
      path: '/notifications/n1/read',
      pathParameters: { notifId: 'n1' },
    }));

    expect(result.statusCode).toBe(200);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
    expect(ddbMock.commandCalls(UpdateCommand)[0]?.args[0].input.Key).toEqual({ PK: 'USER#admin-1', SK: 'NOTIF#1#n1' });
  });

  it('returns 400 when the notification does not exist', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const result = await handler(fakeEvent({
      httpMethod: 'PUT',
      path: '/notifications/missing/read',
      pathParameters: { notifId: 'missing' },
    }));

    expect(result.statusCode).toBe(400);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });
});

describe('PUT /notifications/read-all', () => {
  it('marks every unread notification for the caller as read', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { PK: 'USER#admin-1', SK: 'NOTIF#1#n1', notifId: 'n1', read: false },
        { PK: 'USER#admin-1', SK: 'NOTIF#2#n2', notifId: 'n2', read: false },
      ],
    });
    ddbMock.on(UpdateCommand).resolves({});

    const result = await handler(fakeEvent({
      httpMethod: 'PUT',
      path: '/notifications/read-all',
      pathParameters: null,
    }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ updated: 2 });
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(2);
  });

  it('scopes the unread lookup to the caller\'s own USER# partition, not other users', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(UpdateCommand).resolves({});

    await handler(fakeEvent({
      httpMethod: 'PUT',
      path: '/notifications/read-all',
      pathParameters: null,
      claims: { sub: 'admin-2' },
    }));

    const queryInput = ddbMock.commandCalls(QueryCommand)[0]?.args[0].input;
    expect(queryInput?.ExpressionAttributeValues).toMatchObject({ ':pk': 'USER#admin-2', ':false': false });
  });

  it('does not update anything when there are no unread notifications', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const result = await handler(fakeEvent({
      httpMethod: 'PUT',
      path: '/notifications/read-all',
      pathParameters: null,
    }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ updated: 0 });
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });

  it('is not matched by the single-notification read route', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ PK: 'USER#admin-1', SK: 'NOTIF#1#read-all', notifId: 'read-all' }] });
    ddbMock.on(UpdateCommand).resolves({});

    // A literal notifId of "read-all" would hit the {notifId}/read route instead,
    // proving the two paths are disambiguated by pathParameters, not string matching.
    const result = await handler(fakeEvent({
      httpMethod: 'PUT',
      path: '/notifications/read-all/read',
      pathParameters: { notifId: 'read-all' },
    }));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).data).toEqual({ notifId: 'read-all' });
  });
});
