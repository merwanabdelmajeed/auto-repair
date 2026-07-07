import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as CognitoService from './CognitoService';

vi.mock('./CognitoService', () => ({
  getSessionUser: vi.fn(),
  login: vi.fn(),
  completeNewPassword: vi.fn(),
  logout: vi.fn(),
}));

function Probe() {
  const { user, isAuthenticated, isLoading, login, completeNewPassword, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <button onClick={() => void login('a@shop.com', 'pw')}>login</button>
      <button onClick={() => void completeNewPassword('newpw')}>complete</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

const fakeUser = { userId: 'u1', email: 'a@shop.com', tenantId: 't1', role: 'TENANT_OWNER', locationIds: [] };

beforeEach(() => vi.clearAllMocks());

describe('AuthProvider', () => {
  it('starts loading, then reflects no session as unauthenticated', async () => {
    vi.mocked(CognitoService.getSessionUser).mockResolvedValue(null);

    render(<AuthProvider><Probe /></AuthProvider>);

    expect(screen.getByTestId('loading').textContent).toBe('true');
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('authed').textContent).toBe('false');
  });

  it('restores an existing session on mount', async () => {
    vi.mocked(CognitoService.getSessionUser).mockResolvedValue(fakeUser);

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'));
    expect(screen.getByTestId('email').textContent).toBe('a@shop.com');
  });

  it('login() sets the user from CognitoService', async () => {
    vi.mocked(CognitoService.getSessionUser).mockResolvedValue(null);
    vi.mocked(CognitoService.login).mockResolvedValue(fakeUser);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => screen.getByText('login').click());

    expect(screen.getByTestId('authed').textContent).toBe('true');
    expect(CognitoService.login).toHaveBeenCalledWith('a@shop.com', 'pw');
  });

  it('completeNewPassword() sets the user from CognitoService', async () => {
    vi.mocked(CognitoService.getSessionUser).mockResolvedValue(null);
    vi.mocked(CognitoService.completeNewPassword).mockResolvedValue(fakeUser);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await act(async () => screen.getByText('complete').click());

    expect(screen.getByTestId('authed').textContent).toBe('true');
  });

  it('logout() clears the user', async () => {
    vi.mocked(CognitoService.getSessionUser).mockResolvedValue(fakeUser);
    vi.mocked(CognitoService.logout).mockResolvedValue(undefined);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authed').textContent).toBe('true'));

    await act(async () => screen.getByText('logout').click());

    expect(screen.getByTestId('authed').textContent).toBe('false');
  });
});

describe('useAuth', () => {
  it('throws when used outside an AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside AuthProvider');
    consoleSpy.mockRestore();
  });
});
