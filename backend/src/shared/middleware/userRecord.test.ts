import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../utils/dynamodb.js';

// jest.setup.ts stubs this module for every other test; exercise the real one.
const { getUserRecord } = jest.requireActual<typeof import('./userRecord')>('./userRecord');

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

describe('getUserRecord', () => {
  it('reads the caller\'s USERS row by tenant and user id', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { status: 'ACTIVE', role: 'TENANT_OWNER', locationIds: ['loc1'] } });

    await expect(getUserRecord('t1', 'u1')).resolves.toEqual({ status: 'ACTIVE', role: 'TENANT_OWNER', locationIds: ['loc1'] });

    const input = ddbMock.commandCalls(GetCommand)[0]?.args[0].input;
    expect(input?.TableName).toBe(TABLE.USERS);
    expect(input?.Key).toEqual({ PK: 'TENANT#t1', SK: 'USER#u1' });
  });

  it('returns undefined when the row is gone', async () => {
    ddbMock.on(GetCommand).resolves({});
    await expect(getUserRecord('t1', 'u1')).resolves.toBeUndefined();
  });
});
