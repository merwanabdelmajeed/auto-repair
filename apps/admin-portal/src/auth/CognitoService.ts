import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  type CognitoUserSession,
} from 'amazon-cognito-identity-js';

const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID as string,
  ClientId: import.meta.env.VITE_COGNITO_PORTAL_CLIENT_ID as string,
});

export interface AuthUser {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  locationIds: string[];
}

export class NewPasswordRequiredError extends Error {
  constructor() {
    super('NEW_PASSWORD_REQUIRED');
    this.name = 'NewPasswordRequiredError';
  }
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
  };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: pool });
    const auth = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(auth, {
      onSuccess: (session) => {
        _pendingUser = null;
        resolve(sessionToUser(session, email));
      },
      onFailure: (err) => {
        _pendingUser = null;
        reject(err);
      },
      newPasswordRequired: () => {
        _pendingUser = user;
        reject(new NewPasswordRequiredError());
      },
    });
  });
}

export async function completeNewPassword(newPassword: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    if (!_pendingUser) {
      reject(new Error('No pending password challenge.'));
      return;
    }
    const user = _pendingUser;
    user.completeNewPasswordChallenge(newPassword, {}, {
      onSuccess: (session) => {
        _pendingUser = null;
        const payload = session.getIdToken().decodePayload();
        resolve(sessionToUser(session, payload['email'] as string));
      },
      onFailure: (err) => {
        _pendingUser = null;
        reject(err);
      },
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
      const rawLocationIds = (payload['custom:locationIds'] as string) ?? '';
      resolve({
        userId: payload['sub'] as string,
        email: payload['email'] as string,
        tenantId: payload['custom:tenantId'] as string,
        role: payload['custom:role'] as string,
        locationIds: rawLocationIds ? rawLocationIds.split(',').filter(Boolean) : [],
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
