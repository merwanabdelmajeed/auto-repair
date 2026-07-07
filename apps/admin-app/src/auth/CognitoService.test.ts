// `var` (not const/let) so the binding is function-hoisted to the top of the module —
// jest.mock() factories are hoisted above even `import` statements, so by the time
// CognitoService.ts's top-level `new CognitoUserPool(...)` runs, these must already
// be assigned (which happens inside the factory itself, synchronously, below).
var mockUserInstance: Record<string, jest.Mock>;
var mockPool: Record<string, jest.Mock>;

jest.mock('amazon-cognito-identity-js', () => {
  mockUserInstance = {
    authenticateUser: jest.fn(),
    completeNewPasswordChallenge: jest.fn(),
    getSession: jest.fn(),
    signOut: jest.fn(),
    updateAttributes: jest.fn(),
  };
  mockPool = { getCurrentUser: jest.fn() };
  return {
    CognitoUserPool: jest.fn(function CognitoUserPool() { return mockPool; }),
    CognitoUser: jest.fn(function CognitoUser() { return mockUserInstance; }),
    AuthenticationDetails: jest.fn(function AuthenticationDetails(args: unknown) { return args; }),
    CognitoUserAttribute: jest.fn(function CognitoUserAttribute(args: unknown) { return args; }),
  };
});

import * as CognitoService from './CognitoService';

beforeEach(() => {
  jest.clearAllMocks();
});

function fakeSession(payloadOverrides: Record<string, unknown> = {}) {
  const payload = {
    sub: 'u1', email: 'session@shop.com',
    'custom:tenantId': 't1', 'custom:role': 'TENANT_OWNER', 'custom:locationIds': 'loc1,loc2',
    given_name: 'Jane', family_name: 'Doe',
    ...payloadOverrides,
  };
  return {
    isValid: () => true,
    getIdToken: () => ({ decodePayload: () => payload, getJwtToken: () => 'id-tok' }),
    getAccessToken: () => ({ getJwtToken: () => 'access-tok' }),
  };
}

// Runs first: `_pendingUser` is module-level state that later "newPasswordRequired"
// tests deliberately populate and never clear, so this assertion must execute
// before any of those run or it will see a stale pending user and hang.
describe('completeNewPassword — no pending challenge', () => {
  it('rejects when there is no pending challenge', async () => {
    await expect(CognitoService.completeNewPassword('newpw')).rejects.toThrow('No pending challenge');
  });
});

describe('login', () => {
  it('resolves an AuthUser on success', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession());
    });

    const user = await CognitoService.login('a@shop.com', 'pw');

    expect(user).toEqual({
      userId: 'u1', email: 'a@shop.com', tenantId: 't1', role: 'TENANT_OWNER',
      locationIds: ['loc1', 'loc2'], givenName: 'Jane', familyName: 'Doe',
    });
  });

  it('handles a missing custom:locationIds claim', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession({ 'custom:locationIds': undefined }));
    });

    const user = await CognitoService.login('a@shop.com', 'pw');
    expect(user.locationIds).toEqual([]);
  });

  it('rejects with the Cognito error on failure', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onFailure: (e: Error) => void }) => {
      callbacks.onFailure(new Error('bad credentials'));
    });

    await expect(CognitoService.login('a@shop.com', 'wrong')).rejects.toThrow('bad credentials');
  });

  it('rejects with NewPasswordRequiredError when Cognito demands a new password', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { newPasswordRequired: () => void }) => {
      callbacks.newPasswordRequired();
    });

    await expect(CognitoService.login('a@shop.com', 'temp')).rejects.toThrow('NEW_PASSWORD_REQUIRED');
  });

  it('rejects with NotAuthorizedRoleError and signs out a CUSTOMER-role account, despite valid Cognito credentials', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession({ 'custom:role': 'CUSTOMER' }));
    });

    await expect(CognitoService.login('customer@shop.com', 'pw')).rejects.toBeInstanceOf(CognitoService.NotAuthorizedRoleError);
    expect(mockUserInstance.signOut).toHaveBeenCalled();
  });

  it.each(['SUPER_ADMIN', 'TENANT_OWNER', 'LOCATION_MANAGER'])('accepts a %s role', async (role) => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession({ 'custom:role': role }));
    });

    await expect(CognitoService.login('admin@shop.com', 'pw')).resolves.toMatchObject({ role });
  });
});

describe('completeNewPassword', () => {
  it('resolves an AuthUser on success after a pending newPasswordRequired challenge', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { newPasswordRequired: () => void }) => {
      callbacks.newPasswordRequired();
    });
    await expect(CognitoService.login('a@shop.com', 'temp')).rejects.toThrow('NEW_PASSWORD_REQUIRED');

    mockUserInstance.completeNewPasswordChallenge.mockImplementation(
      (_pw: string, _attrs: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
        callbacks.onSuccess(fakeSession({ email: 'a@shop.com' }));
      },
    );

    const user = await CognitoService.completeNewPassword('newpw');
    expect(user).toMatchObject({ userId: 'u1', email: 'a@shop.com' });
  });

  it('rejects when the challenge completion fails', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { newPasswordRequired: () => void }) => {
      callbacks.newPasswordRequired();
    });
    await expect(CognitoService.login('a@shop.com', 'temp')).rejects.toThrow('NEW_PASSWORD_REQUIRED');

    mockUserInstance.completeNewPasswordChallenge.mockImplementation(
      (_pw: string, _attrs: unknown, callbacks: { onFailure: (e: Error) => void }) => {
        callbacks.onFailure(new Error('weak password'));
      },
    );

    await expect(CognitoService.completeNewPassword('weak')).rejects.toThrow('weak password');
  });

  it('rejects with NotAuthorizedRoleError and signs out a non-admin role after completing a new password', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { newPasswordRequired: () => void }) => {
      callbacks.newPasswordRequired();
    });
    await expect(CognitoService.login('a@shop.com', 'temp')).rejects.toThrow('NEW_PASSWORD_REQUIRED');

    mockUserInstance.completeNewPasswordChallenge.mockImplementation(
      (_pw: string, _attrs: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
        callbacks.onSuccess(fakeSession({ email: 'a@shop.com', 'custom:role': 'CUSTOMER' }));
      },
    );

    await expect(CognitoService.completeNewPassword('newpw')).rejects.toBeInstanceOf(CognitoService.NotAuthorizedRoleError);
    expect(mockUserInstance.signOut).toHaveBeenCalled();
  });
});

describe('logout', () => {
  it('signs out the current user when one exists', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    await CognitoService.logout();
    expect(mockUserInstance.signOut).toHaveBeenCalled();
  });

  it('does nothing when there is no current user', async () => {
    mockPool.getCurrentUser.mockReturnValue(null);
    await expect(CognitoService.logout()).resolves.toBeUndefined();
  });
});

describe('getSessionUser', () => {
  it('resolves null when there is no current user', async () => {
    mockPool.getCurrentUser.mockReturnValue(null);
    await expect(CognitoService.getSessionUser()).resolves.toBeNull();
  });

  it('resolves null when the session is invalid or errored', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(new Error('expired'), null));
    await expect(CognitoService.getSessionUser()).resolves.toBeNull();
  });

  it('resolves an AuthUser for a valid session', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession()));
    await expect(CognitoService.getSessionUser()).resolves.toMatchObject({ userId: 'u1', tenantId: 't1', locationIds: ['loc1', 'loc2'] });
  });

  it('resolves null and signs out a restored session with a non-admin role', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession({ 'custom:role': 'CUSTOMER' })));

    await expect(CognitoService.getSessionUser()).resolves.toBeNull();
    expect(mockUserInstance.signOut).toHaveBeenCalled();
  });
});

describe('getAccessToken / getIdToken', () => {
  it('both resolve null when there is no current user', async () => {
    mockPool.getCurrentUser.mockReturnValue(null);
    await expect(CognitoService.getAccessToken()).resolves.toBeNull();
    await expect(CognitoService.getIdToken()).resolves.toBeNull();
  });

  it('both resolve null when the session is invalid', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(new Error('x'), null));
    await expect(CognitoService.getAccessToken()).resolves.toBeNull();
    await expect(CognitoService.getIdToken()).resolves.toBeNull();
  });

  it('resolve the respective tokens for a valid session', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession()));
    await expect(CognitoService.getAccessToken()).resolves.toBe('access-tok');
    await expect(CognitoService.getIdToken()).resolves.toBe('id-tok');
  });
});

describe('updateProfile', () => {
  it('rejects when there is no current user', async () => {
    mockPool.getCurrentUser.mockReturnValue(null);
    await expect(CognitoService.updateProfile('J', 'D')).rejects.toThrow('Not authenticated');
  });

  it('rejects when the session is invalid', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(new Error('x'), null));
    await expect(CognitoService.updateProfile('J', 'D')).rejects.toThrow('Session invalid');
  });

  it('updates the given_name/family_name attributes for a valid session', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession()));
    mockUserInstance.updateAttributes.mockImplementation((_attrs: unknown, cb: (e: Error | null) => void) => cb(null));

    await expect(CognitoService.updateProfile('Jane', 'Doe')).resolves.toBeUndefined();
    const attrs = mockUserInstance.updateAttributes.mock.calls[0][0];
    expect(attrs).toEqual(expect.arrayContaining([
      { Name: 'given_name', Value: 'Jane' },
      { Name: 'family_name', Value: 'Doe' },
    ]));
  });

  it('rejects when the Cognito update call fails', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession()));
    mockUserInstance.updateAttributes.mockImplementation((_attrs: unknown, cb: (e: Error | null) => void) => cb(new Error('boom')));

    await expect(CognitoService.updateProfile('Jane', 'Doe')).rejects.toThrow('boom');
  });
});
