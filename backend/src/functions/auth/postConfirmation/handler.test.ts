import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import { handler } from './handler';

const ddbMock = mockClient(db);

beforeEach(() => ddbMock.reset());

function fakeEvent(overrides: Partial<PostConfirmationTriggerEvent> = {}): PostConfirmationTriggerEvent {
  return {
    triggerSource: 'PostConfirmation_ConfirmSignUp',
    request: {
      userAttributes: {
        sub: 'user-1',
        email: 'customer@shop.com',
        given_name: 'Jane',
        family_name: 'Doe',
        'custom:tenantId': 't1',
      },
    },
    ...overrides,
  } as unknown as PostConfirmationTriggerEvent;
}

describe('PostConfirmation trigger', () => {
  it('ignores non-ConfirmSignUp trigger sources', async () => {
    const event = fakeEvent({ triggerSource: 'PostConfirmation_ConfirmForgotPassword' as never });

    await handler(event);

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('skips writing a user record when tenantId is missing (e.g. admin-created users)', async () => {
    const event = fakeEvent({ request: { userAttributes: { sub: 'admin-1', email: 'a@shop.com' } } as never });

    await handler(event);

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });

  it('writes a CUSTOMER user record when tenantId is present', async () => {
    ddbMock.on(PutCommand).resolves({});

    const event = fakeEvent();
    const result = await handler(event);

    expect(result).toBe(event);
    const call = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(call?.TableName).toBe(TABLE.USERS);
    expect(call?.Item).toMatchObject({
      PK: 'TENANT#t1',
      SK: 'USER#user-1',
      role: 'CUSTOMER',
      email: 'customer@shop.com',
      firstName: 'Jane',
      lastName: 'Doe',
    });
  });

  it('includes phone only when custom:phone is present', async () => {
    ddbMock.on(PutCommand).resolves({});

    await handler(fakeEvent({
      request: {
        userAttributes: {
          sub: 'user-2', email: 'x@shop.com', 'custom:tenantId': 't1', 'custom:phone': '+15551234567',
        },
      } as never,
    }));

    const call = ddbMock.commandCalls(PutCommand)[0]?.args[0].input;
    expect(call?.Item).toMatchObject({ phone: '+15551234567' });
  });

  it('swallows a conditional-check failure when the user record already exists', async () => {
    ddbMock.on(PutCommand).rejects(new Error('ConditionalCheckFailedException'));

    const event = fakeEvent();
    await expect(handler(event)).resolves.toBe(event);
  });
});
