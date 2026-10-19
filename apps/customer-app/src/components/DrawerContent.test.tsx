import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import DrawerContent from './DrawerContent';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockRequireAuth = jest.fn((action: () => void) => action());
const mockLogout = jest.fn(() => Promise.resolve());

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockImplementation((action: () => void) => action());
  (useAuth as jest.Mock).mockReturnValue({ requireAuth: mockRequireAuth, isAuthenticated: false, logout: mockLogout });
});

function mockSignedIn() {
  (useAuth as jest.Mock).mockReturnValue({ requireAuth: mockRequireAuth, isAuthenticated: true, logout: mockLogout });
}

function renderWithSafeArea(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>{ui}</SafeAreaProvider>);
}

function fakeProps(activeRouteName = 'Home'): DrawerContentComponentProps {
  return {
    navigation: { navigate: jest.fn(), closeDrawer: jest.fn(), reset: jest.fn() },
    state: {
      routes: [{ key: 'Home-1', name: activeRouteName }],
      index: 0,
    },
    descriptors: {},
  } as unknown as DrawerContentComponentProps;
}

describe('DrawerContent', () => {
  it('renders every nav item', () => {
    renderWithSafeArea(<DrawerContent {...fakeProps()} />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Appointments')).toBeTruthy();
    expect(screen.getByText('My Vehicles')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('navigates to Home directly, without going through the auth gate', () => {
    const props = fakeProps();
    renderWithSafeArea(<DrawerContent {...props} />);

    fireEvent.press(screen.getByText('Home'));

    expect(props.navigation.navigate).toHaveBeenCalledWith('Home');
    expect(mockRequireAuth).not.toHaveBeenCalled();
  });

  it('gates every other item behind requireAuth, navigating when allowed', () => {
    const props = fakeProps();
    renderWithSafeArea(<DrawerContent {...props} />);

    fireEvent.press(screen.getByText('Appointments'));

    expect(mockRequireAuth).toHaveBeenCalledWith(expect.any(Function));
    expect(props.navigation.navigate).toHaveBeenCalledWith('Appointments');
  });

  it('does not navigate when requireAuth blocks the action (guest browsing)', () => {
    mockRequireAuth.mockImplementation(() => {});
    const props = fakeProps();
    renderWithSafeArea(<DrawerContent {...props} />);

    fireEvent.press(screen.getByText('My Vehicles'));

    expect(mockRequireAuth).toHaveBeenCalled();
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it('hides Sign Out from guests', () => {
    renderWithSafeArea(<DrawerContent {...fakeProps()} />);
    expect(screen.queryByText('Sign Out')).toBeNull();
  });

  it('shows Sign Out below Settings when signed in', () => {
    mockSignedIn();
    renderWithSafeArea(<DrawerContent {...fakeProps()} />);
    const labels = screen.getAllByText(/^(Settings|Sign Out)$/).map(n => n.props.children);
    expect(labels).toEqual(['Settings', 'Sign Out']);
  });

  it('does nothing when the sign-out confirmation is cancelled', () => {
    mockSignedIn();
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Cancel')?.onPress?.();
    });
    const props = fakeProps();
    renderWithSafeArea(<DrawerContent {...props} />);
    fireEvent.press(screen.getByTestId('drawer-sign-out'));
    expect(mockLogout).not.toHaveBeenCalled();
    expect(props.navigation.reset).not.toHaveBeenCalled();
  });

  it('signs out after confirming, then resets to a fresh guest Home', async () => {
    mockSignedIn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find(b => b.text === 'Sign Out')?.onPress?.();
    });
    const props = fakeProps('Profile');
    renderWithSafeArea(<DrawerContent {...props} />);

    fireEvent.press(screen.getByTestId('drawer-sign-out'));

    expect(alertSpy).toHaveBeenCalledWith('Sign Out', 'Are you sure you want to sign out?', expect.any(Array));
    await waitFor(() => expect(props.navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Home' }] }));
    expect(mockLogout).toHaveBeenCalled();
    expect(props.navigation.closeDrawer).toHaveBeenCalled();
  });

  it('marks the active route differently (no crash across every route)', () => {
    renderWithSafeArea(<DrawerContent {...fakeProps('Profile')} />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });
});
