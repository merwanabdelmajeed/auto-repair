import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import VerifyEmailScreen from './VerifyEmailScreen';
import { useAuth } from '../auth/AuthContext';
import { confirmRegistration, resendConfirmationCode } from '../auth/CognitoService';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../auth/CognitoService', () => ({ confirmRegistration: jest.fn(), resendConfirmationCode: jest.fn() }));

const mockLogin = jest.fn();
const mockOnVerified = jest.fn();
const mockOnNavigateToLogin = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ login: mockLogin });
});

function renderScreen() {
  return render(<VerifyEmailScreen email="a@shop.com" password="pw123456" onVerified={mockOnVerified} onNavigateToLogin={mockOnNavigateToLogin} />);
}

describe('VerifyEmailScreen', () => {
  it('shows the target email', () => {
    renderScreen();
    expect(screen.getByText('We sent a code to a@shop.com')).toBeTruthy();
  });

  it('requires a code before verifying', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Verify'));
    expect(screen.getByText('Enter the verification code sent to your email.')).toBeTruthy();
    expect(confirmRegistration).not.toHaveBeenCalled();
  });

  it('confirms registration, logs in, and calls onVerified on success', async () => {
    (confirmRegistration as jest.Mock).mockResolvedValue(undefined);
    mockLogin.mockResolvedValue(undefined);
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('123456'), '654321');
    fireEvent.press(screen.getByText('Verify'));

    await waitFor(() => expect(confirmRegistration).toHaveBeenCalledWith('a@shop.com', '654321'));
    expect(mockLogin).toHaveBeenCalledWith('a@shop.com', 'pw123456');
    expect(mockOnVerified).toHaveBeenCalled();
  });

  it('shows an error and does not call onVerified when confirmation fails', async () => {
    (confirmRegistration as jest.Mock).mockRejectedValue(new Error('Invalid code'));
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('123456'), '000000');
    fireEvent.press(screen.getByText('Verify'));

    await waitFor(() => expect(screen.getByText('Invalid code')).toBeTruthy());
    expect(mockOnVerified).not.toHaveBeenCalled();
  });

  it('falls back to a generic error for a non-Error rejection', async () => {
    (confirmRegistration as jest.Mock).mockRejectedValue('oops');
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText('123456'), '000000');
    fireEvent.press(screen.getByText('Verify'));

    await waitFor(() => expect(screen.getByText('Verification failed. Please try again.')).toBeTruthy());
  });

  it('resends the code and shows a confirmation banner', async () => {
    (resendConfirmationCode as jest.Mock).mockResolvedValue(undefined);
    renderScreen();

    fireEvent.press(screen.getByText('Resend code'));

    await waitFor(() => expect(screen.getByText('A new code has been sent.')).toBeTruthy());
    expect(resendConfirmationCode).toHaveBeenCalledWith('a@shop.com');
  });

  it('shows an error when resend fails', async () => {
    (resendConfirmationCode as jest.Mock).mockRejectedValue(new Error('rate limited'));
    renderScreen();

    fireEvent.press(screen.getByText('Resend code'));

    await waitFor(() => expect(screen.getByText('rate limited')).toBeTruthy());
  });

  it('navigates back to login', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Sign in'));
    expect(mockOnNavigateToLogin).toHaveBeenCalled();
  });
});
