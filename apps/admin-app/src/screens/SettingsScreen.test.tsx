import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from './SettingsScreen';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../auth/CognitoService';
import { updateProfileName } from '../api/users';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../auth/CognitoService', () => ({ updateProfile: jest.fn() }));
jest.mock('../api/users', () => ({ updateProfileName: jest.fn() }));

const mockLogout = jest.fn();
const mockUpdateUser = jest.fn();

const fakeUser = { userId: 'u1', email: 'jane@shop.com', tenantId: 't1', role: 'ADMIN', locationIds: [], givenName: 'Jane', familyName: 'Doe' };

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ user: fakeUser, logout: mockLogout, updateUser: mockUpdateUser });
});

describe('SettingsScreen', () => {
  it('shows the full name and email in the tenant banner', () => {
    render(<SettingsScreen />);
    expect(screen.getAllByText('Jane Doe').length).toBeGreaterThan(0);
    expect(screen.getByText('jane@shop.com')).toBeTruthy();
  });

  it('falls back to the email as the display name when given/family name are missing', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { ...fakeUser, givenName: '', familyName: '' }, logout: mockLogout, updateUser: mockUpdateUser });
    render(<SettingsScreen />);
    expect(screen.getAllByText('jane@shop.com').length).toBeGreaterThan(0);
  });

  it('opens the profile modal pre-filled with the current name via the Admin Profile row', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Admin Profile'));

    expect(screen.getByDisplayValue('Jane')).toBeTruthy();
    expect(screen.getByDisplayValue('Doe')).toBeTruthy();
  });

  it('validates that first and last name are required', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Admin Profile'));

    fireEvent.changeText(screen.getByPlaceholderText('First name'), '');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), '');
    fireEvent.press(screen.getByText('Save Changes'));

    expect(screen.getByText('First and last name are required.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('saves the profile — updates Cognito AND persists the name to the backend', async () => {
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    (updateProfileName as jest.Mock).mockResolvedValue({ firstName: 'Janet', lastName: 'Smith' });
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Admin Profile'));

    fireEvent.changeText(screen.getByPlaceholderText('First name'), 'Janet');
    fireEvent.changeText(screen.getByPlaceholderText('Last name'), 'Smith');
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith('Janet', 'Smith'));
    expect(updateProfileName).toHaveBeenCalledWith('Janet', 'Smith');
    expect(mockUpdateUser).toHaveBeenCalledWith({ givenName: 'Janet', familyName: 'Smith' });
    await waitFor(() => expect(screen.queryByPlaceholderText('First name')).toBeNull());
  });

  it('shows an error message when the Cognito update fails (and skips the backend call)', async () => {
    (updateProfile as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Admin Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
    expect(updateProfileName).not.toHaveBeenCalled();
  });

  it('shows an error when the backend name sync fails', async () => {
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    (updateProfileName as jest.Mock).mockRejectedValue(new Error('network error'));
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Admin Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
  });

  it('closes the profile modal via the close button without saving', () => {
    render(<SettingsScreen />);
    fireEvent.press(screen.getByText('Admin Profile'));
    expect(screen.getByPlaceholderText('First name')).toBeTruthy();

    fireEvent.press(screen.getByText('close'));
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

  it('does not show the old non-functional Location/Booking/Notifications placeholder rows', () => {
    render(<SettingsScreen />);
    expect(screen.queryByText('Business Information')).toBeNull();
    expect(screen.queryByText('Manage Locations')).toBeNull();
    expect(screen.queryByText('Business Hours')).toBeNull();
    expect(screen.queryByText('Accept Online Bookings')).toBeNull();
    expect(screen.queryByText('Booking Alerts')).toBeNull();
    expect(screen.queryByText('Email Summaries')).toBeNull();
    expect(screen.queryByText(/Phase 4/)).toBeNull();
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
