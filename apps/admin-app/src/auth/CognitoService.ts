import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserAttribute,
  AuthenticationDetails,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';

// @ts-ignore's below: see the identical note in ../api/client.ts. Do not wrap
// these in a cast/alias: that breaks Expo's Babel EXPO_PUBLIC_* inlining.
const pool = new CognitoUserPool({
  // @ts-ignore
  UserPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID,
  // @ts-ignore
  ClientId: process.env.EXPO_PUBLIC_COGNITO_ADMIN_CLIENT_ID,
});

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  locationIds: string[];
  givenName: string;
  familyName: string;
}

export class NewPasswordRequiredError extends Error {
  constructor() {
    super('NEW_PASSWORD_REQUIRED');
    this.name = 'NewPasswordRequiredError';
  }
}

export class NotAuthorizedRoleError extends Error {
  constructor() {
    super('This account does not have admin access.');
    this.name = 'NotAuthorizedRoleError';
  }
}

// Cognito validates credentials at the User Pool level, not per app client, so a
// customer's credentials authenticate successfully against this admin client
// too — the API rejects their requests server-side, but without this check the
// app would still let them into a signed-in (just broken) shell.
const ADMIN_ROLES = ['SUPER_ADMIN', 'TENANT_OWNER', 'LOCATION_MANAGER'];
function isAdminRole(role: string | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

let _pendingUser: CognitoUser | null = null;

function sessionToUser(session: CognitoUserSession, email: string): AuthUser {
  const payload = session.getIdToken().decodePayload();
  const rawLocationIds = (payload['custom:locationIds'] as string) ?? '';
  return {
    userId: payload['sub'] as string,
    email,
    tenantId: payload['custom:tenantId'] as string,
    role: payload['custom:role'] as string,
    locationIds: rawLocationIds ? rawLocationIds.split(',').filter(Boolean) : [],
    givenName: (payload['given_name'] as string) ?? '',
    familyName: (payload['family_name'] as string) ?? '',
  };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool });
    const auth = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(auth, {
      onSuccess: (session) => {
        _pendingUser = null;
        const authUser = sessionToUser(session, email);
        if (!isAdminRole(authUser.role)) {
          user.signOut();
          reject(new NotAuthorizedRoleError());
          return;
        }
        resolve(authUser);
      },
      onFailure: (err) => { _pendingUser = null; reject(err); },
      newPasswordRequired: () => { _pendingUser = user; reject(new NewPasswordRequiredError()); },
    });
  });
}

export async function completeNewPassword(newPassword: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    if (!_pendingUser) { reject(new Error('No pending challenge')); return; }
    const user = _pendingUser;
    user.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => {
        _pendingUser = null;
        const payload = session.getIdToken().decodePayload();
        const authUser = sessionToUser(session, payload['email'] as string);
        if (!isAdminRole(authUser.role)) {
          user.signOut();
          reject(new NotAuthorizedRoleError());
          return;
        }
        resolve(authUser);
      },
      onFailure: (err) => { _pendingUser = null; reject(err); },
    });
  });
}

export async function logout(): Promise<void> {
  pool.getCurrentUser()?.signOut();
}

export async function getSessionUser(): Promise<AuthUser | null> {
  return new Promise((resolve) => {
    const user = pool.getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session || !session.isValid()) return resolve(null);
      const payload = session.getIdToken().decodePayload();
      const role = payload['custom:role'] as string;
      if (!isAdminRole(role)) {
        // A previously-valid session whose role no longer qualifies (or a stale
        // customer session from before this check existed) — sign out rather
        // than restore it.
        user.signOut();
        return resolve(null);
      }
      const rawLocationIds = (payload['custom:locationIds'] as string) ?? '';
      resolve({
        userId: payload['sub'] as string,
        email: payload['email'] as string,
        tenantId: payload['custom:tenantId'] as string,
        role,
        locationIds: rawLocationIds ? rawLocationIds.split(',').filter(Boolean) : [],
        givenName: (payload['given_name'] as string) ?? '',
        familyName: (payload['family_name'] as string) ?? '',
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

export async function updateProfile(givenName: string, familyName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user = pool.getCurrentUser();
    if (!user) return reject(new Error('Not authenticated'));
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return reject(new Error('Session invalid'));
      const attrs = [
        new CognitoUserAttribute({ Name: 'given_name', Value: givenName }),
        new CognitoUserAttribute({ Name: 'family_name', Value: familyName }),
      ];
      user.updateAttributes(attrs, (updateErr) => {
        if (updateErr) return reject(updateErr);
        resolve();
      });
    });
  });
}
