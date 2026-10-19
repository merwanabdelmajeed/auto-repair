import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from './ProfileScreen';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../auth/CognitoService';
import { getMyProfile, updateMyProfile } from '../api/users';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = require('react');
  return { ...actual, useFocusEffect: (effect: () => void) => React.useEffect(effect, []) };
});
jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../auth/CognitoService', () => ({
  updateProfile: jest.fn(),
}));
jest.mock('../api/users', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

const mockLogout = jest.fn();
const mockUpdateUser = jest.fn();

function setup(user: Record<string, unknown> | null) {
  (useAuth as jest.Mock).mockReturnValue({ user, logout: mockLogout, updateUser: mockUpdateUser });
}

beforeEach(() => {
  jest.clearAllMocks();
  (getMyProfile as jest.Mock).mockResolvedValue({
    firstName: 'Jane', lastName: 'Doe', phone: '(949) 555-1234',
    address: { line1: '1 Main St', city: 'Irvine', state: 'CA', postalCode: '92618' },
  });
});

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

  it('shows the phone number loaded from the API', async () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    expect(screen.getByText('Phone Number')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('(949) 555-1234')).toBeTruthy());
    expect(screen.queryByText('Verify')).toBeNull();
  });

  it('shows the address loaded from the API on one line', async () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    expect(screen.getByText('Address')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('1 Main St, Irvine, CA 92618')).toBeTruthy());
  });

  it('shows "—" for phone and address when the load fails', async () => {
    (getMyProfile as jest.Mock).mockRejectedValue(new Error('down'));
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    await waitFor(() => expect(getMyProfile).toHaveBeenCalled());
    expect(screen.getAllByText('—')).toHaveLength(2);
  });
});

describe('ProfileScreen — edit profile modal', () => {
  it('opens pre-filled with the current name and phone', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('(949) 555-1234')).toBeTruthy());

    fireEvent.press(screen.getByText('Edit Profile'));

    expect(screen.getByDisplayValue('Jane')).toBeTruthy();
    expect(screen.getByDisplayValue('Doe')).toBeTruthy();
    expect(screen.getByPlaceholderText('(555) 555-5555').props.value).toBe('(949) 555-1234');
  });

  it('formats the phone as it is typed', () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.changeText(screen.getByPlaceholderText('(555) 555-5555'), '7142223333');

    expect(screen.getByPlaceholderText('(555) 555-5555').props.value).toBe('(714) 222-3333');
  });

  it('pre-fills the address and saves edits as separate fields', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    (updateMyProfile as jest.Mock).mockResolvedValue({});
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('1 Main St, Irvine, CA 92618')).toBeTruthy());
    fireEvent.press(screen.getByText('Edit Profile'));

    expect(screen.getByPlaceholderText('123 Main St').props.value).toBe('1 Main St');
    fireEvent.changeText(screen.getByPlaceholderText('Apt 4B'), ' Apt 2 ');
    fireEvent.changeText(screen.getByPlaceholderText('Lake Forest'), 'Tustin');
    fireEvent.press(screen.getByText('Save Changes'));

    const saved = { line1: '1 Main St', line2: 'Apt 2', city: 'Tustin', state: 'CA', postalCode: '92618' };
    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledWith('Jane', 'Doe', '(949) 555-1234', saved));
    await waitFor(() => expect(screen.getByText('1 Main St, Apt 2, Tustin, CA 92618')).toBeTruthy());
  });

  it('clears the address when every address field is emptied', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    (updateMyProfile as jest.Mock).mockResolvedValue({});
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('1 Main St, Irvine, CA 92618')).toBeTruthy());
    fireEvent.press(screen.getByText('Edit Profile'));

    for (const placeholder of ['123 Main St', 'Lake Forest', 'CA', '92630']) {
      fireEvent.changeText(screen.getByPlaceholderText(placeholder), '');
    }
    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledWith('Jane', 'Doe', '(949) 555-1234', null));
    await waitFor(() => expect(screen.queryByText('1 Main St, Irvine, CA 92618')).toBeNull());
  });

  it('requires a phone number', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));
    fireEvent.changeText(screen.getByPlaceholderText('(555) 555-5555'), '');

    fireEvent.press(screen.getByText('Save Changes'));

    expect(screen.getByText('Phone number is required.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('requires first and last name', () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    expect(screen.getByText('First and last name are required.')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('saves successfully — updates Cognito AND persists name + phone to the backend', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    (updateMyProfile as jest.Mock).mockResolvedValue({});
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('(949) 555-1234')).toBeTruthy());
    fireEvent.press(screen.getByText('Edit Profile'));
    fireEvent.changeText(screen.getByPlaceholderText('(555) 555-5555'), '7142223333');

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith('Jane', 'Doe'));
    expect(updateMyProfile).toHaveBeenCalledWith('Jane', 'Doe', '(714) 222-3333', {
      line1: '1 Main St', city: 'Irvine', state: 'CA', postalCode: '92618',
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ givenName: 'Jane', familyName: 'Doe' });
    await waitFor(() => expect(screen.queryByText('Save Changes')).toBeNull());
    expect(screen.getByText('(714) 222-3333')).toBeTruthy();
  });

  it('shows an error when the Cognito update fails', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('(949) 555-1234')).toBeTruthy());
    fireEvent.press(screen.getByText('Edit Profile'));

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => expect(screen.getByText('Failed to save. Please try again.')).toBeTruthy());
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('shows an error (and keeps the modal open) when the backend name sync fails', async () => {
    setup({ givenName: 'Jane', familyName: 'Doe', email: 'jane@shop.com' });
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    (updateMyProfile as jest.Mock).mockRejectedValue(new Error('network'));
    render(<ProfileScreen />);
    await waitFor(() => expect(screen.getByText('(949) 555-1234')).toBeTruthy());
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
  it('no longer has a Sign Out button (it lives in the side menu)', () => {
    setup({ email: 'jane@shop.com' });
    render(<ProfileScreen />);
    expect(screen.queryByText('Sign Out')).toBeNull();
  });
});
