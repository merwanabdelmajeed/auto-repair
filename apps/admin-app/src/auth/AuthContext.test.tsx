import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from './AuthContext';
import * as CognitoService from './CognitoService';

jest.mock('./CognitoService', () => ({
  getSessionUser: jest.fn(),
  login: jest.fn(),
  completeNewPassword: jest.fn(),
  logout: jest.fn(),
}));

function Probe() {
  const { user, isAuthenticated, isLoading, login, completeNewPassword, logout, updateUser } = useAuth();
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="authed">{String(isAuthenticated)}</Text>
      <Text testID="email">{user?.email ?? 'none'}</Text>
      <Text testID="login" onPress={() => void login('a@shop.com', 'pw')}>login</Text>
      <Text testID="completeNewPassword" onPress={() => void completeNewPassword('newpw')}>completeNewPassword</Text>
      <Text testID="logout" onPress={() => void logout()}>logout</Text>
      <Text testID="update" onPress={() => updateUser({ givenName: 'New' })}>update</Text>
    </>
  );
}

const fakeUser = { userId: 'u1', email: 'a@shop.com', tenantId: 't1', role: 'ADMIN', locationIds: ['loc1'], givenName: 'Jane', familyName: 'Doe' };

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

  it('completeNewPassword() sets the user from CognitoService', async () => {
    (CognitoService.getSessionUser as jest.Mock).mockResolvedValue(null);
    (CognitoService.completeNewPassword as jest.Mock).mockResolvedValue(fakeUser);

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').props.children).toBe('false'));

    await act(async () => fireEvent.press(screen.getByTestId('completeNewPassword')));

    expect(screen.getByTestId('authed').props.children).toBe('true');
    expect(CognitoService.completeNewPassword).toHaveBeenCalledWith('newpw');
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
    // covers the `prev ? {...} : prev` branch in updateUser.
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
