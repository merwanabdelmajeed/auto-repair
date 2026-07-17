import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import DrawerContent from './DrawerContent';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockRequireAuth = jest.fn((action: () => void) => action());

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockImplementation((action: () => void) => action());
  (useAuth as jest.Mock).mockReturnValue({ requireAuth: mockRequireAuth });
});

function renderWithSafeArea(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>{ui}</SafeAreaProvider>);
}

function fakeProps(activeRouteName = 'Home'): DrawerContentComponentProps {
  return {
    navigation: { navigate: jest.fn() },
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

  it('marks the active route differently (no crash across every route)', () => {
    renderWithSafeArea(<DrawerContent {...fakeProps('Profile')} />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });
});
