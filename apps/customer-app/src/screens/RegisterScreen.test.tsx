import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RegisterScreen from './RegisterScreen';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockRegister = jest.fn();
const mockOnRegistered = jest.fn();
const mockOnNavigateToLogin = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ register: mockRegister });
});

function fillRequiredFields(overrides: Partial<Record<'first' | 'last' | 'email' | 'phone' | 'password' | 'confirm', string>> = {}) {
  fireEvent.changeText(screen.getByPlaceholderText('Jane'), overrides.first ?? 'Jane');
  fireEvent.changeText(screen.getByPlaceholderText('Smith'), overrides.last ?? 'Doe');
  fireEvent.changeText(screen.getByPlaceholderText('your@email.com'), overrides.email ?? 'jane@shop.com');
  fireEvent.changeText(screen.getByPlaceholderText('(555) 555-5555'), overrides.phone ?? '9495551234');
  fireEvent.changeText(screen.getByPlaceholderText('At least 8 characters'), overrides.password ?? 'password1');
  fireEvent.changeText(screen.getByPlaceholderText('Repeat password'), overrides.confirm ?? 'password1');
}

describe('RegisterScreen', () => {
  it('requires all fields', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fireEvent.press(screen.getByTestId('register-submit-btn'));
    expect(screen.getByText('Please fill in all required fields.')).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('requires a phone number', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields({ phone: '' });
    fireEvent.press(screen.getByTestId('register-submit-btn'));
    expect(screen.getByText('Please fill in all required fields.')).toBeTruthy();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('formats the phone number as it is typed', () => {
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fireEvent.changeText(screen.getByPlaceholderText('(555) 555-5555'), '9495551234');
    expect(screen.getByPlaceholderText('(555) 555-5555').props.value).toBe('(949) 555-1234');
  });

  it('registers with the address split into fields when one is entered', async () => {
    mockRegister.mockResolvedValue(undefined);
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields();
    fireEvent.changeText(screen.getByPlaceholderText('123 Main St'), ' 1 Main St ');
    fireEvent.changeText(screen.getByPlaceholderText('Apt 4B'), 'Apt 2');
    fireEvent.changeText(screen.getByPlaceholderText('Lake Forest'), 'Irvine');
    fireEvent.changeText(screen.getByPlaceholderText('CA'), 'CA');
    fireEvent.changeText(screen.getByPlaceholderText('92630'), '92618');

    fireEvent.press(screen.getByTestId('register-submit-btn'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith(
      'jane@shop.com', 'password1', 'purrfect-17', 'Jane', 'Doe', '(949) 555-1234',
      { line1: '1 Main St', line2: 'Apt 2', city: 'Irvine', state: 'CA', postalCode: '92618' },
    ));
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

  it('registers with trimmed names/email', async () => {
    mockRegister.mockResolvedValue(undefined);
    render(<RegisterScreen onNavigateToLogin={mockOnNavigateToLogin} onRegistered={mockOnRegistered} />);
    fillRequiredFields({ first: '  Jane  ', last: '  Doe  ', email: '  jane@shop.com  ' });

    fireEvent.press(screen.getByTestId('register-submit-btn'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledWith(
      'jane@shop.com', 'password1', 'purrfect-17', 'Jane', 'Doe', '(949) 555-1234', undefined,
    ));
    expect(mockOnRegistered).toHaveBeenCalledWith('jane@shop.com', 'password1');
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
