import React from 'react';
import { ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import RootNavigator from './RootNavigator';
import { useAuth } from '../auth/AuthContext';
import { getNotifications } from '../api/notifications';

function renderNav() {
  return render(<NavigationContainer><RootNavigator /></NavigationContainer>);
}

const mockHideAuthPrompt = jest.fn();

function mockAuth(overrides: Record<string, unknown> = {}) {
  (useAuth as jest.Mock).mockReturnValue({
    isAuthenticated: false,
    isLoading: false,
    authPromptVisible: false,
    hideAuthPrompt: mockHideAuthPrompt,
    ...overrides,
  });
}

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/notifications', () => ({
  getNotifications: jest.fn().mockResolvedValue([]),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  registerPushToken: jest.fn(),
}));
jest.mock('../hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }));

jest.mock('../screens/LoginScreen', () => (props: { onNavigateToRegister: () => void }) => {
  const { Text } = require('react-native');
  return <Text onPress={props.onNavigateToRegister}>LoginScreen</Text>;
});
jest.mock('../screens/RegisterScreen', () => (props: { onNavigateToLogin: () => void; onRegistered: (e: string, p: string) => void }) => {
  const { Text } = require('react-native');
  return <Text onPress={() => props.onRegistered('new@shop.com', 'pw123')}>RegisterScreen</Text>;
});
jest.mock('../screens/VerifyEmailScreen', () => (props: { email: string; password: string; onVerified: () => void; onNavigateToLogin: () => void }) => {
  const { Text, View } = require('react-native');
  return (
    <View>
      <Text>VerifyEmailScreen:{props.email}</Text>
      <Text onPress={props.onVerified}>verify-confirm</Text>
    </View>
  );
});
jest.mock('../screens/HomeScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>HomeScreen</Text>;
});
jest.mock('../screens/AppointmentsScreen', () => () => null);
jest.mock('../screens/VehiclesScreen', () => () => null);
jest.mock('../screens/PromotionsScreen', () => () => null);
jest.mock('../screens/NotificationsScreen', () => () => null);
jest.mock('../screens/ProfileScreen', () => () => null);
jest.mock('../screens/SettingsScreen', () => () => null);

beforeEach(() => jest.clearAllMocks());

describe('RootNavigator', () => {
  it('shows a loading spinner while auth is resolving', () => {
    mockAuth({ isLoading: true });
    renderNav();
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('shows the Home/Drawer app by default, even when unauthenticated (guest browsing)', () => {
    mockAuth({ isAuthenticated: false });
    renderNav();
    expect(screen.getByText('HomeScreen')).toBeTruthy();
    expect(screen.queryByText('LoginScreen')).toBeNull();
  });

  it('shows the Login overlay on top of Home when authPromptVisible is true', () => {
    mockAuth({ isAuthenticated: false, authPromptVisible: true });
    renderNav();
    expect(screen.getByText('HomeScreen')).toBeTruthy();
    expect(screen.getByText('LoginScreen')).toBeTruthy();
  });

  it('closes the overlay via the close button, calling hideAuthPrompt', () => {
    mockAuth({ isAuthenticated: false, authPromptVisible: true });
    renderNav();

    fireEvent.press(screen.getByTestId('auth-overlay-close'));

    expect(mockHideAuthPrompt).toHaveBeenCalled();
  });

  it('walks Login -> Register -> VerifyEmail -> back to Login within the overlay', () => {
    mockAuth({ isAuthenticated: false, authPromptVisible: true });
    renderNav();

    fireEvent.press(screen.getByText('LoginScreen'));
    expect(screen.getByText('RegisterScreen')).toBeTruthy();

    fireEvent.press(screen.getByText('RegisterScreen'));
    expect(screen.getByText('VerifyEmailScreen:new@shop.com')).toBeTruthy();

    fireEvent.press(screen.getByText('verify-confirm'));
    expect(screen.getByText('LoginScreen')).toBeTruthy();
  });

  it('renders the drawer app (Home + notification bell) when authenticated', async () => {
    mockAuth({ isAuthenticated: true });
    renderNav();
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    expect(screen.getByText('HomeScreen')).toBeTruthy();
  });

  it('shows an unread badge on the notification bell once notifications load', async () => {
    mockAuth({ isAuthenticated: true });
    (getNotifications as jest.Mock).mockResolvedValue([
      { notifId: 'n1', type: 'promotion_new', title: 'T', body: 'B', read: false, createdAt: 'c', appointmentId: null, promoId: null },
    ]);

    renderNav();

    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
  });
});
