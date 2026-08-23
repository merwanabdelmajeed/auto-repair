import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';

// @ts-ignore's below: see the identical note in ../api/client.ts. Do not wrap
// these in a cast/alias: that breaks Expo's Babel EXPO_PUBLIC_* inlining.
const pool = new CognitoUserPool({
  // @ts-ignore
  UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID,
  // @ts-ignore
  ClientId: process.env.EXPO_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID,
});

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  givenName?: string;
  familyName?: string;
}

export class NotAuthorizedRoleError extends Error {
  constructor() {
    super('Admin accounts can’t sign in to the customer app. Please use the admin portal.');
    this.name = 'NotAuthorizedRoleError';
  }
}

// The customer app and admin portal share one Cognito User Pool, and Cognito
// validates credentials at the pool level (not per app client) — so an admin's
// credentials authenticate successfully against the customer client too. The
// API rejects an admin's customer requests server-side, but without this check
// the app would still render a signed-in (broken) shell for them. This is the
// mirror of the portal's admin-only allowlist: a blocklist, because self-signed-
// up customers have no custom:role claim at all (PostConfirmation only writes
// the role to DynamoDB), so anything that isn't an admin role is a customer.
const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_OWNER', 'LOCATION_MANAGER'];
function isAdminRole(role: string | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
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
  };
}

export async function register(
  email: string,
  password: string,
  tenantId: string,
  firstName: string,
  lastName: string,
  phone?: string,
  smsConsent?: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'given_name', Value: firstName }),
      new CognitoUserAttribute({ Name: 'family_name', Value: lastName }),
      new CognitoUserAttribute({ Name: 'custom:tenantId', Value: tenantId }),
      ...(phone ? [new CognitoUserAttribute({ Name: 'custom:phone', Value: phone })] : []),
      ...(phone && smsConsent ? [new CognitoUserAttribute({ Name: 'custom:smsConsent', Value: 'true' })] : []),
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
      onSuccess: (session) => {
        const authUser = sessionToUser(session, email);
        if (isAdminRole(authUser.role)) {
          user.signOut();
          reject(new NotAuthorizedRoleError());
          return;
        }
        resolve(authUser);
      },
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
      const role = payload['custom:role'] as string;
      if (isAdminRole(role)) {
        // A stale/valid admin session (e.g. one created before this check
        // existed) — sign out rather than restore a broken customer shell.
        user.signOut();
        return resolve(null);
      }
      resolve({
        userId: payload['sub'] as string,
        email: payload['email'] as string,
        tenantId: payload['custom:tenantId'] as string,
        role,
        givenName: payload['given_name'] as string | undefined,
        familyName: payload['family_name'] as string | undefined,
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

export async function updateProfile(firstName: string, lastName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = pool.getCurrentUser();
    if (!user) return reject(new Error('Not authenticated'));
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return reject(new Error('Session invalid'));
      const attrs = [
        new CognitoUserAttribute({ Name: 'given_name', Value: firstName }),
        new CognitoUserAttribute({ Name: 'family_name', Value: lastName }),
      ];
      user.updateAttributes(attrs, (updateErr) => {
        if (updateErr) return reject(updateErr);
        resolve();
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
