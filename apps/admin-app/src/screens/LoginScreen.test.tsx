import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from './LoginScreen';
import { useAuth } from '../auth/AuthContext';
import { NewPasswordRequiredError } from '../auth/CognitoService';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
// LoginScreen imports NewPasswordRequiredError directly from CognitoService, whose real
// module constructs a CognitoUserPool at import time and throws without env vars — mock
// it with an equivalent class so `instanceof` checks in LoginScreen still work.
jest.mock('../auth/CognitoService', () => {
  class NewPasswordRequiredError extends Error {
    constructor() {
      super('NEW_PASSWORD_REQUIRED');
      this.name = 'NewPasswordRequiredError';
    }
  }
  return { NewPasswordRequiredError };
});

const mockLogin = jest.fn();
const mockCompleteNewPassword = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ login: mockLogin, completeNewPassword: mockCompleteNewPassword });
});

describe('LoginScreen', () => {
  it('validates that email and password are both required', () => {
    render(<LoginScreen />);
    fireEvent.press(screen.getByText('Sign In'));
    expect(screen.getByText('Email and password are required.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with trimmed email and the password', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('admin@yourshop.com'), '  a@shop.com  ');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@shop.com', 'pw123456'));
  });

  it('shows the Cognito error message on failure', async () => {
    mockLogin.mockRejectedValue(new Error('Incorrect username or password.'));
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('admin@yourshop.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => expect(screen.getByText('Incorrect username or password.')).toBeTruthy());
  });

  it('falls back to a generic error message for a non-Error rejection', async () => {
    mockLogin.mockRejectedValue('some string rejection');
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('admin@yourshop.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => expect(screen.getByText('Login failed. Please try again.')).toBeTruthy());
  });

  it('toggles password visibility', () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('login-toggle-password'));

    expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(false);
  });

  it('switches to the new-password step on NewPasswordRequiredError, then completes it', async () => {
    mockLogin.mockRejectedValue(new NewPasswordRequiredError());
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('admin@yourshop.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'temp');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => expect(screen.getByText('Set a new password')).toBeTruthy());

    mockCompleteNewPassword.mockResolvedValue(undefined);
    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'newpassword1');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm new password'), 'newpassword1');
    fireEvent.press(screen.getByText('Set Password'));

    await waitFor(() => expect(mockCompleteNewPassword).toHaveBeenCalledWith('newpassword1'));
  });

  it('validates the new-password step requires both fields', async () => {
    mockLogin.mockRejectedValue(new NewPasswordRequiredError());
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('admin@yourshop.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'temp');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => expect(screen.getByText('Set a new password')).toBeTruthy());

    fireEvent.press(screen.getByText('Set Password'));
    expect(screen.getByText('Please fill in both password fields.')).toBeTruthy();
  });

  it('validates the new passwords match', async () => {
    mockLogin.mockRejectedValue(new NewPasswordRequiredError());
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('admin@yourshop.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'temp');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => expect(screen.getByText('Set a new password')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'newpassword1');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm new password'), 'different');
    fireEvent.press(screen.getByText('Set Password'));

    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
  });

  it('validates the new password minimum length', async () => {
    mockLogin.mockRejectedValue(new NewPasswordRequiredError());
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('admin@yourshop.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'temp');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => expect(screen.getByText('Set a new password')).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'short');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm new password'), 'short');
    fireEvent.press(screen.getByText('Set Password'));

    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
  });

  it('shows an error message when completing the new password fails', async () => {
    mockLogin.mockRejectedValue(new NewPasswordRequiredError());
    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('admin@yourshop.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'temp');
    fireEvent.press(screen.getByText('Sign In'));
    await waitFor(() => expect(screen.getByText('Set a new password')).toBeTruthy());

    mockCompleteNewPassword.mockRejectedValue(new Error('weak password'));
    fireEvent.changeText(screen.getByPlaceholderText('New password'), 'newpassword1');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm new password'), 'newpassword1');
    fireEvent.press(screen.getByText('Set Password'));

    await waitFor(() => expect(screen.getByText('weak password')).toBeTruthy());
  });
});
