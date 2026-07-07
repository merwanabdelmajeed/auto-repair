import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';

const _env = process.env as unknown as Record<string, string>;
const pool = new CognitoUserPool({
  UserPoolId: _env['EXPO_PUBLIC_COGNITO_USER_POOL_ID'],
  ClientId: _env['EXPO_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID'],
});

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  givenName?: string;
  familyName?: string;
  phone?: string;
  phoneVerified?: boolean;
}

// Phone verification targets the standard `phone_number` attribute, which Cognito
// requires in E.164 format. The app only collects US numbers (10 digits), matching
// the existing display-formatting logic used at registration and in the profile screen.
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `+1${digits}`;
}

function sessionToUser(session: CognitoUserSession, email: string): AuthUser {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();
  return {
    userId: payload['sub'] as string,
    email,
    tenantId: payload['custom:tenantId'] as string,
    role: payload['custom:role'] as string,
    givenName: payload['given_name'] as string | undefined,
    familyName: payload['family_name'] as string | undefined,
    phone: payload['custom:phone'] as string | undefined,
    phoneVerified: payload['phone_number_verified'] as boolean | undefined,
  };
}

export async function register(
  email: string,
  password: string,
  tenantId: string,
  firstName: string,
  lastName: string,
  phone?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'given_name', Value: firstName }),
      new CognitoUserAttribute({ Name: 'family_name', Value: lastName }),
      new CognitoUserAttribute({ Name: 'custom:tenantId', Value: tenantId }),
      ...(phone ? [
        new CognitoUserAttribute({ Name: 'custom:phone', Value: phone }),
        new CognitoUserAttribute({ Name: 'phone_number', Value: toE164(phone) }),
      ] : []),
    ];
    pool.signUp(email, password, attributes, [], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function confirmRegistration(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool });
    user.confirmRegistration(code, true, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function resendConfirmationCode(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool });
    user.resendConfirmationCode((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool });
    const auth = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(auth, {
      onSuccess: (session) => resolve(sessionToUser(session, email)),
      onFailure: reject,
    });
  });
}

export async function logout(): Promise<void> {
  const user = pool.getCurrentUser();
  user?.signOut();
}

export async function getSessionUser(): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    const user = pool.getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) return resolve(null);
      const payload = session.getIdToken().decodePayload();
      resolve({
        userId: payload['sub'] as string,
        email: payload['email'] as string,
        tenantId: payload['custom:tenantId'] as string,
        role: payload['custom:role'] as string,
        givenName: payload['given_name'] as string | undefined,
        familyName: payload['family_name'] as string | undefined,
        phone: payload['custom:phone'] as string | undefined,
        phoneVerified: payload['phone_number_verified'] as boolean | undefined,
      });
    });
  });
}

export async function getAccessToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = pool.getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) return resolve(null);
      resolve(session.getAccessToken().getJwtToken());
    });
  });
}

export async function updateProfile(firstName: string, lastName: string, phone: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = pool.getCurrentUser();
    if (!user) return reject(new Error('Not authenticated'));
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return reject(new Error('Session invalid'));
      const attrs = [
        new CognitoUserAttribute({ Name: 'given_name', Value: firstName }),
        new CognitoUserAttribute({ Name: 'family_name', Value: lastName }),
        new CognitoUserAttribute({ Name: 'custom:phone', Value: phone }),
        ...(phone ? [new CognitoUserAttribute({ Name: 'phone_number', Value: toE164(phone) })] : []),
      ];
      user.updateAttributes(attrs, (updateErr) => {
        if (updateErr) return reject(updateErr);
        resolve();
      });
    });
  });
}

export async function sendPhoneVerificationCode(phone: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = pool.getCurrentUser();
    if (!user) return reject(new Error('Not authenticated'));
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return reject(new Error('Session invalid'));
      // Re-sync the standard `phone_number` attribute from the displayed phone
      // before requesting a code. Accounts created (or last edited) before this
      // attribute existed only ever had `custom:phone` set, so `phone_number`
      // can be empty even though the profile screen shows a phone number and a
      // "Verify" button — Cognito then rejects the code request with "User does
      // not have a valid registered phone number."
      user.updateAttributes([new CognitoUserAttribute({ Name: 'phone_number', Value: toE164(phone) })], (updateErr) => {
        if (updateErr) return reject(updateErr);
        user.getAttributeVerificationCode('phone_number', {
          onSuccess: () => resolve(),
          onFailure: reject,
        });
      });
    });
  });
}

export async function confirmPhoneVerification(code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = pool.getCurrentUser();
    if (!user) return reject(new Error('Not authenticated'));
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return reject(new Error('Session invalid'));
      user.verifyAttribute('phone_number', code, {
        onSuccess: () => resolve(),
        onFailure: reject,
      });
    });
  });
}

export async function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user = pool.getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) return resolve(null);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}
