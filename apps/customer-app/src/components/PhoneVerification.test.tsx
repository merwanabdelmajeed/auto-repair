import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import PhoneVerification from './PhoneVerification';
import { sendPhoneCode, confirmPhoneCode } from '../api/verification';

jest.mock('../api/verification', () => ({
  sendPhoneCode: jest.fn(),
  confirmPhoneCode: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

describe('PhoneVerification', () => {
  it('validates the phone number before sending', () => {
    render(<PhoneVerification />);
    fireEvent.changeText(screen.getByTestId('phone-input'), '555');
    fireEvent.press(screen.getByTestId('phone-send-btn'));
    expect(screen.getByText('Enter a valid 10-digit phone number.')).toBeTruthy();
    expect(sendPhoneCode).not.toHaveBeenCalled();
  });

  it('sends a code and advances to the code step', async () => {
    (sendPhoneCode as jest.Mock).mockResolvedValue({ sent: true, resendInSeconds: 60, expiresInSeconds: 600 });
    render(<PhoneVerification />);

    fireEvent.changeText(screen.getByTestId('phone-input'), '5551234567');
    fireEvent.press(screen.getByTestId('phone-send-btn'));

    await waitFor(() => expect(sendPhoneCode).toHaveBeenCalledWith('(555) 123-4567'));
    expect(screen.getByTestId('phone-code-input')).toBeTruthy();
  });

  it('surfaces a send error', async () => {
    (sendPhoneCode as jest.Mock).mockRejectedValue(new Error('Too many verification codes requested. Try again later.'));
    render(<PhoneVerification />);

    fireEvent.changeText(screen.getByTestId('phone-input'), '5551234567');
    fireEvent.press(screen.getByTestId('phone-send-btn'));

    await waitFor(() => expect(screen.getByText(/Too many verification codes/)).toBeTruthy());
  });

  it('verifies the code and shows the verified state', async () => {
    (sendPhoneCode as jest.Mock).mockResolvedValue({ sent: true, resendInSeconds: 60, expiresInSeconds: 600 });
    (confirmPhoneCode as jest.Mock).mockResolvedValue({ verified: true, phone: '+15551234567' });
    render(<PhoneVerification />);

    fireEvent.changeText(screen.getByTestId('phone-input'), '5551234567');
    fireEvent.press(screen.getByTestId('phone-send-btn'));
    await waitFor(() => expect(screen.getByTestId('phone-code-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('phone-code-input'), '654321');
    fireEvent.press(screen.getByTestId('phone-verify-btn'));

    await waitFor(() => expect(confirmPhoneCode).toHaveBeenCalledWith('(555) 123-4567', '654321'));
    expect(screen.getByText('(555) 123-4567 is verified')).toBeTruthy();
  });

  it('rejects a short code without calling the API', async () => {
    (sendPhoneCode as jest.Mock).mockResolvedValue({ sent: true, resendInSeconds: 60, expiresInSeconds: 600 });
    render(<PhoneVerification />);

    fireEvent.changeText(screen.getByTestId('phone-input'), '5551234567');
    fireEvent.press(screen.getByTestId('phone-send-btn'));
    await waitFor(() => expect(screen.getByTestId('phone-code-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('phone-code-input'), '12');
    fireEvent.press(screen.getByTestId('phone-verify-btn'));

    expect(screen.getByText('Enter the 6-digit code we texted you.')).toBeTruthy();
    expect(confirmPhoneCode).not.toHaveBeenCalled();
  });

  it('surfaces a verify error', async () => {
    (sendPhoneCode as jest.Mock).mockResolvedValue({ sent: true, resendInSeconds: 60, expiresInSeconds: 600 });
    (confirmPhoneCode as jest.Mock).mockRejectedValue(new Error('That code is incorrect.'));
    render(<PhoneVerification />);

    fireEvent.changeText(screen.getByTestId('phone-input'), '5551234567');
    fireEvent.press(screen.getByTestId('phone-send-btn'));
    await waitFor(() => expect(screen.getByTestId('phone-code-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('phone-code-input'), '000000');
    fireEvent.press(screen.getByTestId('phone-verify-btn'));

    await waitFor(() => expect(screen.getByText('That code is incorrect.')).toBeTruthy());
  });
});
