import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from './LoginScreen';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockLogin = jest.fn();
const mockOnNavigateToRegister = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
});

describe('LoginScreen', () => {
  it('validates that email and password are both required', () => {
    render(<LoginScreen onNavigateToRegister={mockOnNavigateToRegister} />);
    fireEvent.press(screen.getByText('Sign In'));
    expect(screen.getByText('Email and password are required.')).toBeTruthy();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with trimmed email and the password', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(<LoginScreen onNavigateToRegister={mockOnNavigateToRegister} />);

    fireEvent.changeText(screen.getByPlaceholderText('your@email.com'), '  a@shop.com  ');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'pw123456');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@shop.com', 'pw123456'));
  });

  it('shows the Cognito error message on failure', async () => {
    mockLogin.mockRejectedValue(new Error('Incorrect username or password.'));
    render(<LoginScreen onNavigateToRegister={mockOnNavigateToRegister} />);

    fireEvent.changeText(screen.getByPlaceholderText('your@email.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => expect(screen.getByText('Incorrect username or password.')).toBeTruthy());
  });

  it('falls back to a generic error message for a non-Error rejection', async () => {
    mockLogin.mockRejectedValue('some string rejection');
    render(<LoginScreen onNavigateToRegister={mockOnNavigateToRegister} />);

    fireEvent.changeText(screen.getByPlaceholderText('your@email.com'), 'a@shop.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(screen.getByText('Sign In'));

    await waitFor(() => expect(screen.getByText('Login failed. Please try again.')).toBeTruthy());
  });

  it('toggles password visibility', () => {
    render(<LoginScreen onNavigateToRegister={mockOnNavigateToRegister} />);
    expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('login-toggle-password'));

    expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(false);
  });

  it('navigates to register when the link is pressed', () => {
    render(<LoginScreen onNavigateToRegister={mockOnNavigateToRegister} />);
    fireEvent.press(screen.getByText('Create an account'));
    expect(mockOnNavigateToRegister).toHaveBeenCalled();
  });
});
