import type { APIGatewayProxyEvent } from 'aws-lambda';
import { createHash } from 'crypto';
import { mockClient } from 'aws-sdk-client-mock';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { handler } from './handler';

const ddbMock = mockClient(db);
const smsMock = mockClient(PinpointSMSVoiceV2Client);

const USER_ID = 'user-1';
const nowSec = () => Math.floor(Date.now() / 1000);
const hash = (code: string) => createHash('sha256').update(`${USER_ID}:${code}`).digest('hex');

beforeEach(() => {
  ddbMock.reset();
  smsMock.reset();
  smsMock.on(SendTextMessageCommand).resolves({ MessageId: 'm-1' });
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(UpdateCommand).resolves({});
  ddbMock.on(DeleteCommand).resolves({});
  process.env.ORIGINATION_NUMBER = '+18557294596';
});

function fakeEvent(path: string, body: Record<string, unknown>, claims?: Record<string, string> | null): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path,
    body: JSON.stringify(body),
    requestContext: claims === null ? {} : {
      authorizer: { claims: { sub: USER_ID, 'custom:tenantId': 't1', email: 'c@x.com', ...(claims ?? {}) } },
    },
  } as unknown as APIGatewayProxyEvent;
}

describe('POST /verification/phone/send', () => {
  it('rejects an invalid phone number', async () => {
    const res = await handler(fakeEvent('/verification/phone/send', { phone: '123' }));
    expect(res.statusCode).toBe(400);
    expect(smsMock.commandCalls(SendTextMessageCommand)).toHaveLength(0);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await handler(fakeEvent('/verification/phone/send', { phone: '5551234567' }, null));
    expect(res.statusCode).toBe(401);
  });

  it('generates a code, stores only its hash, and texts it from the toll-free number', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });

    const res = await handler(fakeEvent('/verification/phone/send', { phone: '(555) 123-4567' }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toMatchObject({ sent: true });

    const put = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item as Record<string, unknown>;
    expect(put.PK).toBe(`USER#${USER_ID}`);
    expect(put.SK).toBe('PHONE#+15551234567');
    expect(put.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(put).not.toHaveProperty('code');
    expect(put.attemptsRemaining).toBe(5);
    expect(typeof put.ttl).toBe('number');

    const sms = smsMock.commandCalls(SendTextMessageCommand)[0].args[0].input;
    expect(sms.DestinationPhoneNumber).toBe('+15551234567');
    expect(sms.OriginationIdentity).toBe('+18557294596');
    expect(sms.MessageBody).toMatch(/verification code is \d{6}/);
  });

  it('enforces the resend cooldown', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { resendAvailableAt: nowSec() + 30, sendCount: 1, windowStart: nowSec() } });

    const res = await handler(fakeEvent('/verification/phone/send', { phone: '5551234567' }));

    expect(res.statusCode).toBe(429);
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
    expect(smsMock.commandCalls(SendTextMessageCommand)).toHaveLength(0);
  });

  it('enforces the hourly send cap', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { resendAvailableAt: nowSec() - 1, sendCount: 5, windowStart: nowSec() - 60 } });

    const res = await handler(fakeEvent('/verification/phone/send', { phone: '5551234567' }));

    expect(res.statusCode).toBe(429);
    expect(smsMock.commandCalls(SendTextMessageCommand)).toHaveLength(0);
  });
});

describe('POST /verification/phone/confirm', () => {
  it('rejects a non 6-digit code', async () => {
    const res = await handler(fakeEvent('/verification/phone/confirm', { phone: '5551234567', code: '12' }));
    expect(res.statusCode).toBe(400);
  });

  it('rejects when no code was requested', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await handler(fakeEvent('/verification/phone/confirm', { phone: '5551234567', code: '123456' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/expired/i);
  });

  it('rejects an expired code', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { codeHash: hash('123456'), expiresAt: nowSec() - 5, attemptsRemaining: 5 } });
    const res = await handler(fakeEvent('/verification/phone/confirm', { phone: '5551234567', code: '123456' }));
    expect(res.statusCode).toBe(400);
  });

  it('decrements attempts on a wrong code', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { codeHash: hash('123456'), expiresAt: nowSec() + 300, attemptsRemaining: 5 } });

    const res = await handler(fakeEvent('/verification/phone/confirm', { phone: '5551234567', code: '000000' }));

    expect(res.statusCode).toBe(400);
    const update = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(update.TableName).toBe(TABLE.VERIFICATIONS);
    expect(update.UpdateExpression).toContain('attemptsRemaining');
  });

  it('rejects once attempts are exhausted', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { codeHash: hash('123456'), expiresAt: nowSec() + 300, attemptsRemaining: 0 } });
    const res = await handler(fakeEvent('/verification/phone/confirm', { phone: '5551234567', code: '123456' }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/too many/i);
  });

  it('marks the phone verified on the user record and clears the code on success', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { codeHash: hash('654321'), expiresAt: nowSec() + 300, attemptsRemaining: 5 } });

    const res = await handler(fakeEvent('/verification/phone/confirm', { phone: '5551234567', code: '654321' }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toMatchObject({ verified: true, phone: '+15551234567' });

    const userUpdate = ddbMock.commandCalls(UpdateCommand).find(c => c.args[0].input.TableName === TABLE.USERS);
    expect(userUpdate?.args[0].input.Key).toEqual({ PK: 'TENANT#t1', SK: `USER#${USER_ID}` });
    expect(userUpdate?.args[0].input.UpdateExpression).toContain('phoneVerified');

    const del = ddbMock.commandCalls(DeleteCommand)[0].args[0].input;
    expect(del.TableName).toBe(TABLE.VERIFICATIONS);
  });
});
