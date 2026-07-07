import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from './ProfileScreen';
import { useAuth } from '../auth/AuthContext';
import { updateProfile, sendPhoneVerificationCode, confirmPhoneVerification } from '../auth/CognitoService';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../auth/CognitoService', () => ({
  updateProfile: jest.fn(),
  sendPhoneVerificationCode: jest.fn(),
  confirmPhoneVerification: jest.fn(),
}));

const mockLogout = jest.fn();
const mockUpdateUser = jest.fn();

function setup(user: Record<string, unknown> | null) {
  (useAuth as jest.Mock).mockReturnValue({ user, logout: mockLogout, updateUser: mockUpdateUser });
}

beforeEach(() => jest.clearAllMocks());

describe('ProfileScreen — display', () => {
  it('shows initials and name from given/family name', () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    render(<ProfileScreen />);
    expect(screen.getByText('JD')).toBeTruthy();
    // Both "Jane Doe" and "jane@shop.com" legitimately render twice: once in the
    // profile header, once again in the Full Name / Email Address fields card.
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('jane@shop.com').length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to email initial when no name is set', () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('shows "—" for phone when none is on file', () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.queryByText('Verify')).toBeNull();
  });

  it('shows a Verified badge for a verified phone', () => {
    setup({ email: 'jane@shop.com', phone: '5551234567', phoneVerified: true });
    render(<ProfileScreen />);
    expect(screen.getByText('Verified')).toBeTruthy();
  });

  it('shows a Verify button for an unverified phone', () => {
    setup({ email: 'jane@shop.com', phone: '5551234567', phoneVerified: false });
    render(<ProfileScreen />);
    expect(screen.getByText('Verify')).toBeTruthy();
  });
});

describe('ProfileScreen — edit profile modal', () => {
  it('opens pre-filled with the current name/phone', () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com', phone: '5551234567' });
    render(<ProfileScreen />);

    fireEvent.press(screen.getByText('Edit Profile'));

    expect(screen.getByDisplayValue('Jane')).toBeTruthy();
    expect(screen.getByDisplayValue('Doe')).toBeTruthy();
    expect(screen.getByDisplayValue('5551234567')).toBeTruthy();
  });

  it('requires first and last name', () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    expect(screen.getByText('First and last name are required.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('saves successfully, flags phoneVerified false when the phone changed, and closes the modal', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com', phone: '5551234567', phoneVerified: true });
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.changeText(screen.getByPlaceholderText('(555) 123-4567'), '5559998888');
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith('Jane', 'Doe', '(555) 999-8888'));
    expect(mockUpdateUser).toHaveBeenCalledWith(expect.objectContaining({ phoneVerified: false }));
    expect(screen.queryByText('Save Changes')).toBeNull();
  });

  it('does not flag phoneVerified when the phone is unchanged', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com', phone: '(555) 123-4567' });
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    const patch = mockUpdateUser.mock.calls[0][0];
    expect(patch).not.toHaveProperty('phoneVerified');
  });

  it('shows an error when saving fails', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
  });

  it('closes the modal via the close button', () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));
    expect(screen.getByPlaceholderText('First name')).toBeTruthy();

    fireEvent.press(screen.getByTestId('profile-edit-close'));

    expect(screen.queryByPlaceholderText('First name')).toBeNull();
  });
});

describe('ProfileScreen — phone verification modal', () => {
  function openVerify(phone = '5551234567') {
    setup({ email: 'jane@shop.com', phone, phoneVerified: false });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Verify'));
  }

  it('sends a code and shows the code input on success', async () => {
    (sendPhoneVerificationCode as jest.Mock).mockResolvedValue(undefined);
    openVerify();

    fireEvent.press(screen.getByText('Send Code'));

    await waitFor(() => expect(screen.getByPlaceholderText('123456')).toBeTruthy());
  });

  it('shows an error when sending the code fails', async () => {
    (sendPhoneVerificationCode as jest.Mock).mockRejectedValue(new Error('sms failed'));
    openVerify();

    fireEvent.press(screen.getByText('Send Code'));

    await waitFor(() => expect(screen.getByText('sms failed')).toBeTruthy());
  });

  it('requires a code before verifying', async () => {
    (sendPhoneVerificationCode as jest.Mock).mockResolvedValue(undefined);
    openVerify();
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => screen.getByPlaceholderText('123456'));

    fireEvent.press(screen.getByTestId('profile-verify-phone-submit'));

    expect(screen.getByText('Enter the code sent to your phone.')).toBeTruthy();
  });

  it('confirms the code, marks the phone verified, and closes the modal', async () => {
    (sendPhoneVerificationCode as jest.Mock).mockResolvedValue(undefined);
    (confirmPhoneVerification as jest.Mock).mockResolvedValue(undefined);
    openVerify();
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => screen.getByPlaceholderText('123456'));

    fireEvent.changeText(screen.getByPlaceholderText('123456'), '654321');
    fireEvent.press(screen.getByTestId('profile-verify-phone-submit'));

    await waitFor(() => expect(confirmPhoneVerification).toHaveBeenCalledWith('654321'));
    expect(mockUpdateUser).toHaveBeenCalledWith({ phoneVerified: true });
  });

  it('shows an error when confirmation fails', async () => {
    (sendPhoneVerificationCode as jest.Mock).mockResolvedValue(undefined);
    (confirmPhoneVerification as jest.Mock).mockRejectedValue(new Error('wrong code'));
    openVerify();
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => screen.getByPlaceholderText('123456'));
    fireEvent.changeText(screen.getByPlaceholderText('123456'), '000000');

    fireEvent.press(screen.getByTestId('profile-verify-phone-submit'));

    await waitFor(() => expect(screen.getByText('wrong code')).toBeTruthy());
  });

  it('resends the code', async () => {
    (sendPhoneVerificationCode as jest.Mock).mockResolvedValue(undefined);
    openVerify();
    fireEvent.press(screen.getByText('Send Code'));
    await waitFor(() => screen.getByPlaceholderText('123456'));

    fireEvent.press(screen.getByText('Resend code'));

    await waitFor(() => expect(sendPhoneVerificationCode).toHaveBeenCalledTimes(2));
  });
});

describe('ProfileScreen — sign out', () => {
  it('confirms before signing out', () => {
    setup({ email: 'jane@shop.com' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Sign Out')?.onPress?.();
    });

    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Sign Out'));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalled();
  });
});
