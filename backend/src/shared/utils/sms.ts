import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { logger } from './logger.js';

const client = new PinpointSMSVoiceV2Client({ region: process.env.AWS_REGION ?? 'us-east-1' });

// Normalizes user-entered US phone input (e.g. "(555) 123-4567", "555-123-4567",
// "+15551234567") to E.164. Returns null for anything that isn't a plausible US
// number, so callers can reject bad input before spending money on an SMS send.
export function toE164Us(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// Sends a transactional SMS from our toll-free origination number via AWS End
// User Messaging. The origination number is injected per-environment through
// ORIGINATION_NUMBER so the same code works across dev/staging/prod stacks.
export async function sendSms(to: string, body: string): Promise<void> {
  const originationIdentity = process.env.ORIGINATION_NUMBER;
  if (!originationIdentity) {
    throw new Error('ORIGINATION_NUMBER is not configured');
  }
  await client.send(new SendTextMessageCommand({
    DestinationPhoneNumber: to,
    OriginationIdentity: originationIdentity,
    MessageBody: body,
    // TRANSACTIONAL prioritizes delivery/latency over cost — the right class for
    // one-time passcodes (as opposed to PROMOTIONAL marketing traffic).
    MessageType: 'TRANSACTIONAL',
  }));
  logger.info('SMS sent', { to });
}
