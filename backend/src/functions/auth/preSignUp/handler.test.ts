import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { handler } from './handler';

function fakeEvent(overrides: Partial<PreSignUpTriggerEvent> = {}): PreSignUpTriggerEvent {
  return {
    triggerSource: 'PreSignUp_SignUp',
    callerContext: { clientId: 'customer-mobile' },
    request: { userAttributes: { 'custom:tenantId': 't1' } },
    ...overrides,
  } as unknown as PreSignUpTriggerEvent;
}

describe('PreSignUp trigger', () => {
  it('bypasses all checks for admin-console-created users', async () => {
    const event = fakeEvent({
      triggerSource: 'PreSignUp_AdminCreateUser',
      callerContext: { clientId: 'admin-mobile' } as never,
      request: { userAttributes: {} } as never,
    });

    await expect(handler(event)).resolves.toBe(event);
  });

  it('rejects self-registration through admin app clients', async () => {
    const event = fakeEvent({ callerContext: { clientId: 'admin-mobile' } as never });

    await expect(handler(event)).rejects.toThrow(/self-registration/i);
  });

  it('rejects self-registration through the admin portal client', async () => {
    const event = fakeEvent({ callerContext: { clientId: 'admin-portal' } as never });

    await expect(handler(event)).rejects.toThrow(/self-registration/i);
  });

  it('rejects customer sign-up without a tenantId', async () => {
    const event = fakeEvent({ request: { userAttributes: {} } as never });

    await expect(handler(event)).rejects.toThrow(/custom:tenantId is required/i);
  });

  it('allows customer sign-up with a tenantId', async () => {
    const event = fakeEvent();

    await expect(handler(event)).resolves.toBe(event);
  });
});
