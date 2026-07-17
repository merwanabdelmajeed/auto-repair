import React from 'react';
import { Alert, Linking } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from './SettingsScreen';
import { useAuth } from '../auth/AuthContext';
import { deleteAccount } from '../api/account';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, SUPPORT_URL } from '../constants';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/account', () => ({ deleteAccount: jest.fn() }));

const mockLogout = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: { email: 'jane@shop.com' }, logout: mockLogout });
});

describe('SettingsScreen', () => {
  it('shows the account email and initial', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('jane@shop.com')).toBeTruthy();
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('shows a fallback when there is no user', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, logout: mockLogout });
    render(<SettingsScreen />);
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('confirms before signing out, and logs out only when confirmed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const signOut = buttons?.find(b => b.text === 'Sign Out');
      signOut?.onPress?.();
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Sign Out'));

    expect(alertSpy).toHaveBeenCalledWith('Sign Out', 'Are you sure you want to sign out?', expect.any(Array));
    expect(mockLogout).toHaveBeenCalled();
  });

  it('does not log out when the alert is cancelled', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find(b => b.text === 'Cancel');
      cancel?.onPress?.();
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Sign Out'));

    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('opens the privacy policy URL when tapped', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Privacy Policy'));

    expect(openURLSpy).toHaveBeenCalledWith(PRIVACY_POLICY_URL);
  });

  it('opens the terms of service URL when tapped', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Terms of Service'));

    expect(openURLSpy).toHaveBeenCalledWith(TERMS_OF_SERVICE_URL);
  });

  it('opens the support URL when tapped', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Help & Support'));

    expect(openURLSpy).toHaveBeenCalledWith(SUPPORT_URL);
  });

  it('does not respond to taps on the non-actionable App Version row', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);

    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('App Version'));

    expect(openURLSpy).not.toHaveBeenCalled();
  });

  it('deletes the account and signs out when confirmed', async () => {
    (deleteAccount as jest.Mock).mockResolvedValue({ deleted: true });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const confirm = buttons?.find(b => b.text === 'Delete Account');
      confirm?.onPress?.();
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-delete-account'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Account',
      expect.stringContaining('permanently delete'),
      expect.any(Array),
    );
    await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });

  it('does not delete the account when the confirmation is cancelled', () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = buttons?.find(b => b.text === 'Cancel');
      cancel?.onPress?.();
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-delete-account'));

    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('shows an error and stays signed in when deletion fails', async () => {
    (deleteAccount as jest.Mock).mockRejectedValue(new Error('boom'));
    jest.spyOn(Alert, 'alert').mockImplementation((title, _msg, buttons) => {
      if (title === 'Delete Account') {
        buttons?.find(b => b.text === 'Delete Account')?.onPress?.();
      }
    });

    render(<SettingsScreen />);
    fireEvent.press(screen.getByTestId('settings-delete-account'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      'Failed to Delete Account',
      expect.any(String),
    ));
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
