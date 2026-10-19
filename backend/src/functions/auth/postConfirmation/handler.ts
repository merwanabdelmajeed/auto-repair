import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE } from '../../../shared/utils/dynamodb.js';
import { sanitizeAddress } from '../../../shared/utils/address.js';

// The customer app sends the (optional) signup address as a JSON string in
// Cognito's standard `address` attribute. Split it back into separate string
// fields for the USERS record; anything malformed or empty is dropped rather
// than failing the signup.
export function parseAddress(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  return sanitizeAddress(parsed);
}

export const handler = async (event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent> => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event;

  const attrs = event.request.userAttributes;
  const tenantId = attrs['custom:tenantId'];
  if (!tenantId) return event;

  const now = new Date().toISOString();
  const address = parseAddress(attrs['address']);

  await db.send(new PutCommand({
    TableName: TABLE.USERS,
    Item: {
      PK: `TENANT#${tenantId}`,
      SK: `USER#${attrs['sub']}`,
      GSI1PK: `TENANT#${tenantId}`,
      GSI1SK: `EMAIL#${attrs['email']}`,
      userId: attrs['sub'],
      tenantId,
      email: attrs['email'],
      firstName: attrs['given_name'] ?? '',
      lastName: attrs['family_name'] ?? '',
      ...(attrs['custom:phone'] ? { phone: attrs['custom:phone'] } : {}),
      ...(address ? { address } : {}),
      ...(attrs['custom:smsConsent'] === 'true' ? { smsConsent: true, smsConsentAt: now } : {}),
      role: 'CUSTOMER',
      userType: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    },
    ConditionExpression: 'attribute_not_exists(PK)',
  })).catch(() => { /* already exists — ignore */ });

  return event;
};
