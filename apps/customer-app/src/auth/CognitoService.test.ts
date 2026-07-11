// `var` (not const/let) so the binding is function-hoisted to the top of the module —
// jest.mock() factories are hoisted above even `import` statements, so by the time
// CognitoService.ts's top-level `new CognitoUserPool(...)` runs, these must already
// be assigned (which happens inside the factory itself, synchronously, below).
var mockUserInstance: Record<string, jest.Mock>;
var mockPool: Record<string, jest.Mock>;

jest.mock('amazon-cognito-identity-js', () => {
  mockUserInstance = {
    authenticateUser: jest.fn(),
    confirmRegistration: jest.fn(),
    resendConfirmationCode: jest.fn(),
    getSession: jest.fn(),
    signOut: jest.fn(),
    updateAttributes: jest.fn(),
  };
  mockPool = { getCurrentUser: jest.fn(), signUp: jest.fn() };
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
    'custom:tenantId': 't1', 'custom:role': 'CUSTOMER', given_name: 'Jane', family_name: 'Doe',
    ...payloadOverrides,
  };
  return {
    isValid: () => true,
    getIdToken: () => ({ decodePayload: () => payload, getJwtToken: () => 'id-tok' }),
    getAccessToken: () => ({ getJwtToken: () => 'access-tok' }),
  };
}

describe('register', () => {
  it('signs up with the required attributes', async () => {
    mockPool.signUp.mockImplementation((_e, _p, _attrs, _v, cb) => cb(null));

    await CognitoService.register('a@shop.com', 'pw', 't1', 'Jane', 'Doe');

    expect(mockPool.signUp).toHaveBeenCalled();
    const attrs = mockPool.signUp.mock.calls[0][2];
    expect(attrs).toEqual(expect.arrayContaining([
      { Name: 'email', Value: 'a@shop.com' },
      { Name: 'given_name', Value: 'Jane' },
      { Name: 'family_name', Value: 'Doe' },
      { Name: 'custom:tenantId', Value: 't1' },
    ]));
    expect(attrs.some((a: { Name: string }) => a.Name === 'custom:phone')).toBe(false);
    expect(attrs.some((a: { Name: string }) => a.Name === 'custom:smsConsent')).toBe(false);
  });

  it('includes custom:phone when a phone is provided, without smsConsent when consent is false', async () => {
    mockPool.signUp.mockImplementation((_e, _p, _attrs, _v, cb) => cb(null));

    await CognitoService.register('a@shop.com', 'pw', 't1', 'Jane', 'Doe', '5551234567', false);

    const attrs = mockPool.signUp.mock.calls[0][2];
    expect(attrs).toEqual(expect.arrayContaining([{ Name: 'custom:phone', Value: '5551234567' }]));
    expect(attrs.some((a: { Name: string }) => a.Name === 'custom:smsConsent')).toBe(false);
  });

  it('includes custom:smsConsent=true only when both a phone and consent are given', async () => {
    mockPool.signUp.mockImplementation((_e, _p, _attrs, _v, cb) => cb(null));

    await CognitoService.register('a@shop.com', 'pw', 't1', 'Jane', 'Doe', '5551234567', true);

    const attrs = mockPool.signUp.mock.calls[0][2];
    expect(attrs).toEqual(expect.arrayContaining([{ Name: 'custom:smsConsent', Value: 'true' }]));
  });

  it('omits custom:smsConsent even when consent is true if no phone was given', async () => {
    mockPool.signUp.mockImplementation((_e, _p, _attrs, _v, cb) => cb(null));

    await CognitoService.register('a@shop.com', 'pw', 't1', 'Jane', 'Doe', undefined, true);

    const attrs = mockPool.signUp.mock.calls[0][2];
    expect(attrs.some((a: { Name: string }) => a.Name === 'custom:smsConsent')).toBe(false);
  });

  it('rejects when Cognito signUp fails', async () => {
    mockPool.signUp.mockImplementation((_e, _p, _attrs, _v, cb) => cb(new Error('email exists')));

    await expect(CognitoService.register('a@shop.com', 'pw', 't1', 'Jane', 'Doe')).rejects.toThrow('email exists');
  });
});

describe('confirmRegistration', () => {
  it('resolves on success', async () => {
    mockUserInstance.confirmRegistration.mockImplementation((_code: string, _f: boolean, cb: (e: Error | null) => void) => cb(null));
    await expect(CognitoService.confirmRegistration('a@shop.com', '123456')).resolves.toBeUndefined();
  });

  it('rejects on failure', async () => {
    mockUserInstance.confirmRegistration.mockImplementation((_code: string, _f: boolean, cb: (e: Error | null) => void) => cb(new Error('bad code')));
    await expect(CognitoService.confirmRegistration('a@shop.com', '000000')).rejects.toThrow('bad code');
  });
});

describe('resendConfirmationCode', () => {
  it('resolves on success', async () => {
    mockUserInstance.resendConfirmationCode.mockImplementation((cb: (e: Error | null) => void) => cb(null));
    await expect(CognitoService.resendConfirmationCode('a@shop.com')).resolves.toBeUndefined();
  });

  it('rejects on failure', async () => {
    mockUserInstance.resendConfirmationCode.mockImplementation((cb: (e: Error | null) => void) => cb(new Error('throttled')));
    await expect(CognitoService.resendConfirmationCode('a@shop.com')).rejects.toThrow('throttled');
  });
});

describe('login', () => {
  it('resolves an AuthUser on success', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onSuccess: (s: unknown) => void }) => {
      callbacks.onSuccess(fakeSession());
    });

    const user = await CognitoService.login('a@shop.com', 'pw');

    expect(user).toEqual({
      userId: 'u1', email: 'a@shop.com', tenantId: 't1', role: 'CUSTOMER',
      givenName: 'Jane', familyName: 'Doe',
    });
  });

  it('rejects with the Cognito error on failure', async () => {
    mockUserInstance.authenticateUser.mockImplementation((_auth: unknown, callbacks: { onFailure: (e: Error) => void }) => {
      callbacks.onFailure(new Error('bad credentials'));
    });

    await expect(CognitoService.login('a@shop.com', 'wrong')).rejects.toThrow('bad credentials');
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
});

describe('getAccessToken / getIdToken', () => {
  it('both resolve null when there is no current user', async () => {
    mockPool.getCurrentUser.mockReturnValue(null);
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

  it('updates given_name/family_name for a valid session', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession()));
    mockUserInstance.updateAttributes.mockImplementation((_attrs: unknown, cb: (e: Error | null) => void) => cb(null));

    await expect(CognitoService.updateProfile('Jane', 'Doe')).resolves.toBeUndefined();
    const attrs = mockUserInstance.updateAttributes.mock.calls[0][0];
    expect(attrs).toEqual([
      { Name: 'given_name', Value: 'Jane' },
      { Name: 'family_name', Value: 'Doe' },
    ]);
  });

  it('rejects when the Cognito update call fails', async () => {
    mockPool.getCurrentUser.mockReturnValue(mockUserInstance);
    mockUserInstance.getSession.mockImplementation((cb: (err: Error | null, s: unknown) => void) => cb(null, fakeSession()));
    mockUserInstance.updateAttributes.mockImplementation((_attrs: unknown, cb: (e: Error | null) => void) => cb(new Error('boom')));

    await expect(CognitoService.updateProfile('Jane', 'Doe')).rejects.toThrow('boom');
  });
});
