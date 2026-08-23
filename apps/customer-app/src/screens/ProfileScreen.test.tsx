import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from './ProfileScreen';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../auth/CognitoService';
import { updateProfileName } from '../api/users';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../auth/CognitoService', () => ({
  updateProfile: jest.fn(),
}));
jest.mock('../api/users', () => ({
  updateProfileName: jest.fn(),
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

  it('does not show a phone field', () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    expect(screen.queryByText('Phone Number')).toBeNull();
    expect(screen.queryByText('Verify')).toBeNull();
  });
});

describe('ProfileScreen — edit profile modal', () => {
  it('opens pre-filled with the current name', () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    render(<ProfileScreen />);

    fireEvent.press(screen.getByText('Edit Profile'));

    expect(screen.getByDisplayValue('Jane')).toBeTruthy();
    expect(screen.getByDisplayValue('Doe')).toBeTruthy();
    expect(screen.queryByPlaceholderText('(555) 123-4567')).toBeNull();
  });

  it('requires first and last name', () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    expect(screen.getByText('First and last name are required.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('saves successfully — updates Cognito AND persists the name to the backend', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    (updateProfileName as jest.Mock).mockResolvedValue({ firstName: 'Jane', lastName: 'Doe' });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith('Jane', 'Doe'));
    expect(updateProfileName).toHaveBeenCalledWith('Jane', 'Doe');
    expect(mockUpdateUser).toHaveBeenCalledWith({ givenName: 'Jane', familyName: 'Doe' });
    expect(screen.queryByText('Save Changes')).toBeNull();
  });

  it('shows an error when the Cognito update fails', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
    expect(updateProfileName).not.toHaveBeenCalled();
  });

  it('shows an error (and keeps the modal open) when the backend name sync fails', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    (updateProfileName as jest.Mock).mockRejectedValue(new Error('network'));
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
    expect(screen.getByText('Save Changes')).toBeTruthy();
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
