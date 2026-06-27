import type { PreSignUpTriggerEvent } from 'aws-lambda';

const CUSTOMER_CLIENT_NAME = 'customer-mobile';
const ADMIN_CLIENT_NAMES = new Set(['admin-mobile', 'admin-portal']);

export const handler = async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> => {
  // Admin console creates (PreSignUp_AdminCreateUser) bypass all checks
  if (event.triggerSource === 'PreSignUp_AdminCreateUser') {
    return event;
  }

  const clientId = event.callerContext.clientId;

  // Prevent self-signup via admin app clients — admins must be created through the console or admin API
  if (ADMIN_CLIENT_NAMES.has(clientId)) {
    throw new Error('Self-registration is not allowed for admin accounts.');
  }

  // Auto-confirm and verify email for customer sign-ups (skip email verification flow for MVP)
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  // tenantId must be supplied by the customer app as a custom attribute during sign-up
  const tenantId = event.request.userAttributes['custom:tenantId'];
  if (!tenantId) {
    throw new Error('custom:tenantId is required during registration.');
  }

  return event;
};
