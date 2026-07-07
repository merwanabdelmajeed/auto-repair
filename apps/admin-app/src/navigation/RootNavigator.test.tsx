import React from 'react';
import { ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { render, screen, waitFor } from '@testing-library/react-native';
import RootNavigator from './RootNavigator';
import { useAuth } from '../auth/AuthContext';
import { getNotifications } from '../api/notifications';

function renderNav() {
  return render(<NavigationContainer><RootNavigator /></NavigationContainer>);
}

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/notifications', () => ({
  getNotifications: jest.fn().mockResolvedValue([]),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  registerPushToken: jest.fn(),
}));
jest.mock('../hooks/usePushNotifications', () => ({ usePushNotifications: jest.fn() }));

jest.mock('../screens/LoginScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>LoginScreen</Text>;
});
jest.mock('../screens/DashboardScreen', () => () => {
  const { Text } = require('react-native');
  return <Text>DashboardScreen</Text>;
});
jest.mock('../screens/BookingsScreen', () => () => null);
jest.mock('../screens/CustomersScreen', () => () => null);
jest.mock('../screens/VehiclesScreen', () => () => null);
jest.mock('../screens/ServicesScreen', () => () => null);
jest.mock('../screens/CapacityScreen', () => () => null);
jest.mock('../screens/BlockedTimesScreen', () => () => null);
jest.mock('../screens/PromotionsScreen', () => () => null);
jest.mock('../screens/StatisticsScreen', () => () => null);
jest.mock('../screens/SettingsScreen', () => () => null);
jest.mock('../screens/NotificationsScreen', () => () => null);

beforeEach(() => jest.clearAllMocks());

describe('RootNavigator', () => {
  it('shows a loading spinner while auth is resolving', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: true });
    renderNav();
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('shows LoginScreen when unauthenticated', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderNav();
    expect(screen.getByText('LoginScreen')).toBeTruthy();
  });

  it('renders the drawer app (Dashboard + notification bell) when authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
    renderNav();
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    expect(screen.getByText('DashboardScreen')).toBeTruthy();
  });

  it('shows an unread badge on the notification bell once notifications load', async () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false });
    (getNotifications as jest.Mock).mockResolvedValue([
      { notifId: 'n1', type: 'promotion_new', title: 'T', body: 'B', read: false, createdAt: 'c', appointmentId: null, promoId: null },
    ]);

    renderNav();

    await waitFor(() => expect(screen.getByText('1')).toBeTruthy());
  });
});
