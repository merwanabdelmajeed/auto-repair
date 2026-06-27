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
}

function sessionToUser(session: CognitoUserSession, email: string): AuthUser {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();
  return {
    userId: payload['sub'] as string,
    email,
    tenantId: payload['custom:tenantId'] as string,
    role: payload['custom:role'] as string,
  };
}

export async function register(
  email: string,
  password: string,
  tenantId: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'custom:tenantId', Value: tenantId }),
    ];
    pool.signUp(email, password, attributes, [], (err) => {
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
