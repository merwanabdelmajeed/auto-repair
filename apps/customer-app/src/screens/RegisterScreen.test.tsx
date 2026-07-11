import React from 'react';
import { Linking } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from './RegisterScreen';
import { useAuth } from '../auth/AuthContext';
import { PRIVACY_POLICY_URL } from '../constants';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockRegister = jest.fn();
const mockOnRegistered = jest.fn();
const mockOnNavigateToLogin = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ register: mockRegister });
});

function fillRequiredFields(overrides: Partial<Record<'first' | 'last' | 'email' | 'password' | 'confirm', string>> = {}) {
  fireEvent.changeText(screen.getByPlaceholderText('Jane'), overrides.first ?? 'Jane');
  fireEvent.changeText(screen.getByPlaceholderText('Smith'), overrides.last ?? 'Doe');
  fireEvent.changeText(screen.getByPlaceholderText('your@email.com'), overrides.email ?? 'jane@shop.com');
  fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), overrides.password ?? 'password1');
  fireEvent.changeText(screen.getByPlaceholderText('Repeat password'), overrides.confirm ?? 'password1');
}

describe('RegisterScreen', () => {
  it('requires all fields', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fireEvent.press(screen.getByTestId('register-submit-btn'));
    expect(screen.getByText('All fields are required.')).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('requires matching passwords', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields({ confirm: 'different1' });
    fireEvent.press(screen.getByTestId('register-submit-btn'));
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
  });

  it('requires at least 8 characters', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields({ password: 'short', confirm: 'short' });
    fireEvent.press(screen.getByTestId('register-submit-btn'));
    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy();
  });

  it('registers with trimmed names/email and no phone/consent when phone is left blank', async () => {
    mockRegister.mockResolvedValue(undefined);
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields({ first: '  Jane  ', last: '  Doe  ', email: '  jane@shop.com  ' });

    fireEvent.press(screen.getByTestId('register-submit-btn'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith(
      'jane@shop.com', 'password1', 'demo-tenant', 'Jane', 'Doe', undefined, undefined,
    ));
    expect(mockOnRegistered).toHaveBeenCalledWith('jane@shop.com', 'password1');
  });

  it('does not show the SMS consent checkbox until a phone number is entered', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    expect(screen.queryByTestId('register-sms-consent')).toBeNull();

    fireEvent.changeText(screen.getByPlaceholderText('(555) 123-4567'), '5551234567');

    expect(screen.getByTestId('register-sms-consent')).toBeTruthy();
  });

  it('hides the consent checkbox again and resets consent when phone is cleared', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
    fireEvent.changeText(phoneInput, '5551234567');
    fireEvent.press(screen.getByTestId('register-sms-consent'));

    fireEvent.changeText(phoneInput, '');

    expect(screen.queryByTestId('register-sms-consent')).toBeNull();
  });

  it('registers with phone but consent undefined-as-false when the box is left unchecked', async () => {
    mockRegister.mockResolvedValue(undefined);
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields();
    fireEvent.changeText(screen.getByPlaceholderText('(555) 123-4567'), '5551234567');

    fireEvent.press(screen.getByTestId('register-submit-btn'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith(
      'jane@shop.com', 'password1', 'demo-tenant', 'Jane', 'Doe', '(555) 123-4567', false,
    ));
  });

  it('registers with phone and smsConsent true when the box is checked', async () => {
    mockRegister.mockResolvedValue(undefined);
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields();
    fireEvent.changeText(screen.getByPlaceholderText('(555) 123-4567'), '5551234567');
    fireEvent.press(screen.getByTestId('register-sms-consent'));

    fireEvent.press(screen.getByTestId('register-submit-btn'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith(
      'jane@shop.com', 'password1', 'demo-tenant', 'Jane', 'Doe', '(555) 123-4567', true,
    ));
  });

  it('opens the privacy policy link from the consent text', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fireEvent.changeText(screen.getByPlaceholderText('(555) 123-4567'), '5551234567');

    fireEvent.press(screen.getByText('Privacy Policy'));

    expect(openURLSpy).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  });

  it('shows the Cognito error message on failure', async () => {
    mockRegister.mockRejectedValue(new Error('email already exists'));
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields();

    fireEvent.press(screen.getByTestId('register-submit-btn'));

    await waitFor(() => expect(screen.getByText('email already exists')).toBeTruthy());
    expect(mockOnRegistered).not.toHaveBeenCalled();
  });

  it('falls back to a generic error for a non-Error rejection', async () => {
    mockRegister.mockRejectedValue('oops');
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields();

    fireEvent.press(screen.getByTestId('register-submit-btn'));

    await waitFor(() => expect(screen.getByText('Registration failed. Please try again.')).toBeTruthy());
  });

  it('toggles password visibility for both password fields', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    expect(screen.getByPlaceholderText('At least 8 characters').props.secureTextEntry).toBe(true);
    expect(screen.getByPlaceholderText('Repeat password').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('register-toggle-password'));

    expect(screen.getByPlaceholderText('At least 8 characters').props.secureTextEntry).toBe(false);
    expect(screen.getByPlaceholderText('Repeat password').props.secureTextEntry).toBe(false);
  });

  it('navigates to login', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockOnNavigateToLogin).toHaveBeenCalled();
  });
});
