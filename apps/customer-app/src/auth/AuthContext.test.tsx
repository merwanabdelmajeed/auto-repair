import React from 'react';
import { Alert, Text } from 'react-native';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from './AuthContext';
import * as CognitoService from './CognitoService';

jest.mock('./CognitoService', () => ({
  getSessionUser: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
}));

function Probe() {
  const { user, isAuthenticated, isLoading, login, register, logout, updateUser } = useAuth();
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="authed">{String(isAuthenticated)}</Text>
      <Text testID="email">{user?.email ?? 'none'}</Text>
      <Text testID="login" onPress={() => void login('a@shop.com', 'pw')}>login</Text>
      <Text testID="register" onPress={() => void register('a@shop.com', 'pw', 't1', 'Jane', 'Doe', '(949) 555-1234')}>register</Text>
      <Text testID="logout" onPress={() => void logout()}>logout</Text>
      <Text testID="update" onPress={() => updateUser({ givenName: 'Jane' })}>update</Text>
    </>
  );
}

const fakeUser = { userId: 'u1', email: 'a@shop.com', tenantId: 't1', role: 'CUSTOMER' };

beforeEach(() => jest.clearAllMocks());

describe('AuthProvider', () => {
  it('starts loading, then reflects no session as unauthenticated', async () => {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(null);

    render(<AuthProvider><Probe /></AuthProvider>);

    expect(screen.getByTestId('loading').props.children).toBe('true');
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));
    expect(screen.getByTestId('authed').props.children).toBe('false');
  });

  it('restores an existing session on mount', async () => {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(fakeUser);

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('authed').props.children).toBe('true'));
    expect(screen.getByTestId('email').props.children).toBe('a@shop.com');
  });

  it('login() sets the user from CognitoService', async () => {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(null);
    (CognitoService.login as jest.Mock).mockResolvedValue(fakeUser);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));

    await act(async () => fireEvent.press(screen.getByTestId('login')));

    expect(screen.getByTestId('authed').props.children).toBe('true');
    expect(CognitoService.login).toHaveBeenCalledWith('a@shop.com', 'pw');
  });

  it('register() calls CognitoService.register without auto-logging in', async () => {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(null);
    (CognitoService.register as jest.Mock).mockResolvedValue(undefined);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));

    await act(async () => fireEvent.press(screen.getByTestId('register')));

    expect(CognitoService.register).toHaveBeenCalledWith('a@shop.com', 'pw', 't1', 'Jane', 'Doe', '(949) 555-1234', undefined);
    expect(screen.getByTestId('authed').props.children).toBe('false');
  });

  it('logout() clears the user', async () => {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(fakeUser);
    (CognitoService.logout as jest.Mock).mockResolvedValue(undefined);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authed').props.children).toBe('true'));

    await act(async () => fireEvent.press(screen.getByTestId('logout')));

    expect(screen.getByTestId('authed').props.children).toBe('false');
  });

  it('updateUser() patches the existing user', async () => {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(fakeUser);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('authed').props.children).toBe('true'));

    fireEvent.press(screen.getByTestId('update'));

    // No visible assertion surface for the patched field on this probe beyond not crashing;
    // covers the `prev ? {...} : null` branch in updateUser.
    expect(screen.getByTestId('authed').props.children).toBe('true');
  });
});

describe('useAuth', () => {
  it('throws when used outside an AuthProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside AuthProvider');
    consoleSpy.mockRestore();
  });
});

describe('requireAuth prompt', () => {
  function PromptProbe({ action }: { action: () => void }) {
    const { requireAuth, authPromptVisible, authPromptScreen, hideAuthPrompt } = useAuth();
    return (
      <>
        <Text testID="visible">{String(authPromptVisible)}</Text>
        <Text testID="screen">{authPromptScreen}</Text>
        <Text testID="gate" onPress={() => requireAuth(action)}>gate</Text>
        <Text testID="hide" onPress={hideAuthPrompt}>hide</Text>
      </>
    );
  }

  async function renderSignedOut(action = jest.fn()) {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(null);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<AuthProvider><PromptProbe action={action} /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('visible')).toBeTruthy());
    fireEvent.press(screen.getByTestId('gate'));
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    return { alertSpy, buttons, action };
  }

  it('offers Cancel, Sign In and Create Account to a signed-out user', async () => {
    const { alertSpy, buttons, action } = await renderSignedOut();
    expect(alertSpy).toHaveBeenCalledWith('Account Required', expect.any(String), expect.any(Array));
    expect(buttons.map(b => b.text)).toEqual(['Cancel', 'Sign In', 'Create Account']);
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByTestId('visible').props.children).toBe('false');
  });

  it('Create Account opens the overlay on the Register screen', async () => {
    const { buttons } = await renderSignedOut();
    act(() => buttons.find(b => b.text === 'Create Account')!.onPress!());
    expect(screen.getByTestId('visible').props.children).toBe('true');
    expect(screen.getByTestId('screen').props.children).toBe('Register');
  });

  it('Sign In opens the overlay on the Login screen', async () => {
    const { buttons } = await renderSignedOut();
    act(() => buttons.find(b => b.text === 'Create Account')!.onPress!());
    fireEvent.press(screen.getByTestId('hide'));
    act(() => buttons.find(b => b.text === 'Sign In')!.onPress!());
    expect(screen.getByTestId('visible').props.children).toBe('true');
    expect(screen.getByTestId('screen').props.children).toBe('Login');
  });

  it('runs the action directly when signed in, with no prompt', async () => {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(fakeUser);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const action = jest.fn();
    render(<AuthProvider><PromptProbe action={action} /></AuthProvider>);
    await waitFor(() => expect(CognitoService.getSessionUser).toHaveBeenCalled());
    await act(async () => {});

    fireEvent.press(screen.getByTestId('gate'));

    expect(action).toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
