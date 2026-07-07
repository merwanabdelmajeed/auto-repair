const { mockPool, mockUserInstance, CognitoUserMock } = vi.hoisted(() => {
  const mockUserInstance = {
    authenticateUser: vi.fn(),
    completeNewPasswordChallenge: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn(),
  };
  const mockPool = { getCurrentUser: vi.fn() };
  const CognitoUserMock = vi.fn(function CognitoUser() { return mockUserInstance; });
  return { mockPool, mockUserInstance, CognitoUserMock };
});

vi.mock('amazon-cognito-identity-js', () => ({
  CognitoUserPool: vi.fn(function CognitoUserPool() { return mockPool; }),
  CognitoUser: CognitoUserMock,
  AuthenticationDetails: vi.fn(function AuthenticationDetails(args: unknown) { return args; }),
}));

let CognitoService: typeof import('./CognitoService');

beforeEach(async () => {
  vi.resetModules();
  mockUserInstance.authenticateUser.mockReset();
  mockUserInstance.completeNewPasswordChallenge.mockReset();
  mockUserInstance.getSession.mockReset();
  mockUserInstance.signOut.mockReset();
  mockPool.getCurrentUser.mockReset();
  CognitoService = await import('./CognitoService');
});

function fakeSession(payloadOverrides: Record<string, unknown> = {}) {
  const payload = {
    sub: 'u1', email: 'session@shop.com',
    'custom:tenantId': 't1', 'custom:role': 'TENANT_OWNER', 'custom:locationIds': 'loc1,loc2',
    ...payloadOverrides,
  };
  return {
    isValid: () => true,
    getIdToken: () => ({ decodePayload: () => payload, getJwtToken: () => 'id-tok' }),
    getAccessToken: () => ({ getJwtToken: () => 'access-tok' }),
  };
}

describe('login', () => {
  it('resolves an AuthUser on success', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession());
    });

    const user = await CognitoService.login('a@shop.com', 'pw');

    expect(user).toEqual({ userId: 'u1', email: 'a@shop.com', tenantId: 't1', role: 'TENANT_OWNER', locationIds: ['loc1', 'loc2'] });
  });

  it('defaults locationIds to [] when custom:locationIds is absent', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession({ 'custom:locationIds': undefined }));
    });

    const user = await CognitoService.login('a@shop.com', 'pw');

    expect(user.locationIds).toEqual([]);
  });

  it('rejects with the Cognito error on failure', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onFailure: (e: Error) => void }) => {
      callbacks.onFailure(new Error('Incorrect username or password'));
    });

    await expect(CognitoService.login('a@shop.com', 'wrong')).rejects.toThrow('Incorrect username or password');
  });

  it('rejects with NewPasswordRequiredError and stashes the pending user', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { newPasswordRequired: () => void }) => {
      callbacks.newPasswordRequired();
    });

    await expect(CognitoService.login('a@shop.com', 'temp-pw')).rejects.toBeInstanceOf(CognitoService.NewPasswordRequiredError);
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
  it('rejects when there is no pending challenge', async () => {
    await expect(CognitoService.completeNewPassword('newpw')).rejects.toThrow('No pending password challenge.');
  });

  it('resolves an AuthUser after a newPasswordRequired challenge', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { newPasswordRequired: () => void }) => {
      callbacks.newPasswordRequired();
    });
    await CognitoService.login('a@shop.com', 'temp-pw').catch(() => {});

    mockUserInstance.completeNewPasswordChallenge.mockImplementation((_pw: string, _attrs: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession({ email: 'a@shop.com' }));
    });

    const user = await CognitoService.completeNewPassword('newpw');
    expect(user).toMatchObject({ userId: 'u1', email: 'a@shop.com' });
  });

  it('rejects with NotAuthorizedRoleError and signs out a non-admin role after completing a new password', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { newPasswordRequired: () => void }) => {
      callbacks.newPasswordRequired();
    });
    await CognitoService.login('a@shop.com', 'temp-pw').catch(() => {});

    mockUserInstance.completeNewPasswordChallenge.mockImplementation((_pw: string, _attrs: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession({ email: 'a@shop.com', 'custom:role': 'CUSTOMER' }));
    });

    await expect(CognitoService.completeNewPassword('newpw')).rejects.toBeInstanceOf(CognitoService.NotAuthorizedRoleError);
    expect(mockUserInstance.signOut).toHaveBeenCalled();
  });

  it('rejects when Cognito rejects the new password', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { newPasswordRequired: () => void }) => {
      callbacks.newPasswordRequired();
    });
    await CognitoService.login('a@shop.com', 'temp-pw').catch(() => {});

    mockUserInstance.completeNewPasswordChallenge.mockImplementation((_pw: string, _attrs: unknown, callbacks: { onFailure: (e: Error) => void }) => {
      callbacks.onFailure(new Error('policy violation'));
    });

    await expect(CognitoService.completeNewPassword('bad')).rejects.toThrow('policy violation');
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
    await expect(CognitoService.getSessionUser()).resolves.toMatchObject({ userId: 'u1', tenantId: 't1' });
  });

  it('resolves null and signs out a restored session with a non-admin role', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession({ 'custom:role': 'CUSTOMER' })));

    await expect(CognitoService.getSessionUser()).resolves.toBeNull();
    expect(mockUserInstance.signOut).toHaveBeenCalled();
  });
});

describe('getAccessToken', () => {
  it('resolves null when there is no current user', async () => {
    mockPool.getCurrentUser.mockReturnValue(null);
    await expect(CognitoService.getAccessToken()).resolves.toBeNull();
  });

  it('resolves the access token for a valid session', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession()));
    await expect(CognitoService.getAccessToken()).resolves.toBe('access-tok');
  });
});

describe('getIdToken', () => {
  it('resolves null when there is no current user', async () => {
    mockPool.getCurrentUser.mockReturnValue(null);
    await expect(CognitoService.getIdToken()).resolves.toBeNull();
  });

  it('resolves the ID token for a valid session', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession()));
    await expect(CognitoService.getIdToken()).resolves.toBe('id-tok');
  });
});
