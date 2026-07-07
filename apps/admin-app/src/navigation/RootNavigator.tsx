import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { AdminDrawerParamList } from './types';
import { colors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import DrawerContent from '../components/DrawerContent';
import { NotificationsProvider, useNotifications } from '../contexts/NotificationsContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from '../screens/LoginScreen';

import DashboardScreen from '../screens/DashboardScreen';
import BookingsScreen from '../screens/BookingsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import VehiclesScreen from '../screens/VehiclesScreen';
import ServicesScreen from '../screens/ServicesScreen';
import CapacityScreen from '../screens/CapacityScreen';
import BlockedTimesScreen from '../screens/BlockedTimesScreen';
import PromotionsScreen from '../screens/PromotionsScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Drawer = createDrawerNavigator<AdminDrawerParamList>();

function NotificationBell({ navigation }: { navigation: any }) {
  const { unreadCount } = useNotifications();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications')}
      style={{ marginRight: 16, position: 'relative' }}
      hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.white} />
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute', top: -4, right: -4,
          backgroundColor: colors.error ?? '#ef4444',
          borderRadius: 8, minWidth: 16, height: 16,
          justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{ color: colors.white, fontSize: 9, fontWeight: '700', lineHeight: 14 }}>
            {unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function AppNavigator() {
  usePushNotifications();

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        drawerStyle: { width: 280, backgroundColor: colors.primary },
        drawerType: 'front',
        overlayColor: colors.overlay,
        headerRight: () => <NotificationBell navigation={navigation} />,
      })}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Bookings' }} />
      <Drawer.Screen name="Customers" component={CustomersScreen} options={{ title: 'Customers' }} />
      <Drawer.Screen name="Vehicles" component={VehiclesScreen} options={{ title: 'Vehicles' }} />
      <Drawer.Screen name="Services" component={ServicesScreen} options={{ title: 'Services' }} />
      <Drawer.Screen name="Capacity" component={CapacityScreen} options={{ title: 'Capacity' }} />
      <Drawer.Screen name="BlockedTimes" component={BlockedTimesScreen} options={{ title: 'Blocked Times' }} />
      <Drawer.Screen name="Promotions" component={PromotionsScreen} options={{ title: 'Promotions' }} />
      <Drawer.Screen name="Statistics" component={StatisticsScreen} options={{ title: 'Statistics' }} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return <LoginScreen />;

  return (
    <NotificationsProvider>
      <AppNavigator />
    </NotificationsProvider>
  );
}
