import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createHash, randomInt } from 'crypto';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../shared/utils/dynamodb.js';
import { extractTenantClaims, UnauthorizedError } from '../../shared/middleware/tenant.js';
import { ok, badRequest, unauthorized, tooManyRequests, serverError } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { sendSms, toE164Us } from '../../shared/utils/sms.js';

const APP_NAME = process.env.APP_NAME ?? 'AutoRepair';
const CODE_TTL_SECONDS = 600;        // code is valid for 10 minutes
const RESEND_COOLDOWN_SECONDS = 60;  // min gap between two sends to one phone
const MAX_SENDS_PER_HOUR = 5;        // per user+phone, rolling hour
const MAX_ATTEMPTS = 5;              // verify attempts before the code is burned
const RECORD_TTL_SECONDS = 3600;     // DynamoDB row auto-expires after an hour

const nowSec = (): number => Math.floor(Date.now() / 1000);

// Codes are stored only as a salted hash so a leak of the verifications table
// never exposes live passcodes. userId is the salt — cheap and unique per row.
const hashCode = (userId: string, code: string): string =>
  createHash('sha256').update(`${userId}:${code}`).digest('hex');

interface VerifyRecord {
  codeHash: string;
  expiresAt: number;
  attemptsRemaining: number;
  resendAvailableAt: number;
  sendCount: number;
  windowStart: number;
}

function parseBody(event: APIGatewayProxyEvent): Record<string, unknown> {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const claims = extractTenantClaims(event);
    const { userId, tenantId } = claims;
    const body = parseBody(event);
    const phoneInput = typeof body.phone === 'string' ? body.phone : '';
    const e164 = toE164Us(phoneInput);
    if (!e164) return badRequest('A valid US phone number is required.');

    const pk = `USER#${userId}`;
    const sk = `PHONE#${e164}`;

    // POST /verification/phone/send
    if (event.path.endsWith('/send')) {
      const now = nowSec();
      const existing = (await db.send(new GetCommand({
        TableName: TABLE.VERIFICATIONS,
        Key: { PK: pk, SK: sk },
      }))).Item as VerifyRecord | undefined;

      if (existing && now < existing.resendAvailableAt) {
        return tooManyRequests(`Please wait ${existing.resendAvailableAt - now}s before requesting another code.`);
      }

      // Rolling-hour cap: reset the counter once the window has elapsed.
      const windowActive = existing && now < existing.windowStart + 3600;
      const sendCount = windowActive ? existing!.sendCount : 0;
      if (sendCount >= MAX_SENDS_PER_HOUR) {
        return tooManyRequests('Too many verification codes requested. Try again later.');
      }

      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

      await db.send(new PutCommand({
        TableName: TABLE.VERIFICATIONS,
        Item: {
          PK: pk,
          SK: sk,
          userId,
          tenantId,
          phone: e164,
          codeHash: hashCode(userId, code),
          expiresAt: now + CODE_TTL_SECONDS,
          attemptsRemaining: MAX_ATTEMPTS,
          resendAvailableAt: now + RESEND_COOLDOWN_SECONDS,
          sendCount: sendCount + 1,
          windowStart: windowActive ? existing!.windowStart : now,
          ttl: now + RECORD_TTL_SECONDS,
        },
      }));

      await sendSms(e164, `Your ${APP_NAME} verification code is ${code}. It expires in 10 minutes. Reply STOP to opt out.`);

      return ok({ sent: true, resendInSeconds: RESEND_COOLDOWN_SECONDS, expiresInSeconds: CODE_TTL_SECONDS });
    }

    // POST /verification/phone/confirm
    if (event.path.endsWith('/confirm')) {
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      if (!/^\d{6}$/.test(code)) return badRequest('Enter the 6-digit code.');

      const now = nowSec();
      const record = (await db.send(new GetCommand({
        TableName: TABLE.VERIFICATIONS,
        Key: { PK: pk, SK: sk },
      }))).Item as VerifyRecord | undefined;

      if (!record || now > record.expiresAt) {
        return badRequest('Your code has expired. Request a new one.');
      }
      if (record.attemptsRemaining <= 0) {
        return badRequest('Too many incorrect attempts. Request a new code.');
      }
      if (hashCode(userId, code) !== record.codeHash) {
        await db.send(new UpdateCommand({
          TableName: TABLE.VERIFICATIONS,
          Key: { PK: pk, SK: sk },
          UpdateExpression: 'SET attemptsRemaining = attemptsRemaining - :one',
          ExpressionAttributeValues: { ':one': 1 },
        }));
        return badRequest('That code is incorrect.');
      }

      // Success — mark the phone verified on the customer's own USER# record.
      // We deliberately store this in DynamoDB rather than a Cognito custom
      // attribute: adding a schema attribute to the pool forces a full pool
      // replacement (see template.yaml UserPool notes).
      await db.send(new UpdateCommand({
        TableName: TABLE.USERS,
        Key: { PK: `TENANT#${tenantId}`, SK: `USER#${userId}` },
        UpdateExpression: 'SET phone = :phone, phoneVerified = :true, phoneVerifiedAt = :now, updatedAt = :now',
        ExpressionAttributeValues: { ':phone': e164, ':true': true, ':now': new Date().toISOString() },
      }));
      await db.send(new DeleteCommand({
        TableName: TABLE.VERIFICATIONS,
        Key: { PK: pk, SK: sk },
      }));

      return ok({ verified: true, phone: e164 });
    }

    return badRequest('Unknown verification action.');
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorized(err.message);
    logger.error('Verification handler error', { error: err });
    return serverError();
  }
};
