import { mockClient } from 'aws-sdk-client-mock';
import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { sendSms, toE164Us } from './sms.js';

const smsMock = mockClient(PinpointSMSVoiceV2Client);

beforeEach(() => {
  smsMock.reset();
  process.env.ORIGINATION_NUMBER = '+18557294596';
});

describe('toE164Us', () => {
  it('normalizes a formatted 10-digit number', () => {
    expect(toE164Us('(555) 123-4567')).toBe('+15551234567');
  });

  it('accepts an 11-digit number already prefixed with country code 1', () => {
    expect(toE164Us('+1 555 123 4567')).toBe('+15551234567');
    expect(toE164Us('15551234567')).toBe('+15551234567');
  });

  it('rejects numbers that are the wrong length', () => {
    expect(toE164Us('12345')).toBeNull();
    expect(toE164Us('+44 20 7946 0958')).toBeNull();
    expect(toE164Us('')).toBeNull();
  });
});

describe('sendSms', () => {
  it('sends from the configured origination number with TRANSACTIONAL type', async () => {
    smsMock.on(SendTextMessageCommand).resolves({ MessageId: 'm-1' });

    await sendSms('+15551234567', 'hello');

    const call = smsMock.commandCalls(SendTextMessageCommand)[0];
    expect(call.args[0].input).toMatchObject({
      DestinationPhoneNumber: '+15551234567',
      OriginationIdentity: '+18557294596',
      MessageBody: 'hello',
      MessageType: 'TRANSACTIONAL',
    });
  });

  it('throws if the origination number is not configured', async () => {
    delete process.env.ORIGINATION_NUMBER;
    await expect(sendSms('+15551234567', 'hi')).rejects.toThrow('ORIGINATION_NUMBER');
    expect(smsMock.commandCalls(SendTextMessageCommand)).toHaveLength(0);
  });
});
