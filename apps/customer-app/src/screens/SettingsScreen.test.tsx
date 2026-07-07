import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import SettingsScreen from './SettingsScreen';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

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
});
