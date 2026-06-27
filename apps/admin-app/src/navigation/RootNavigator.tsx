import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { AdminDrawerParamList } from './types';
import { colors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import DrawerContent from '../components/DrawerContent';

import LoginScreen from '../screens/LoginScreen';

import DashboardScreen from '../screens/DashboardScreen';
import BookingsScreen from '../screens/BookingsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import VehiclesScreen from '../screens/VehiclesScreen';
import ServicesScreen from '../screens/ServicesScreen';
import PromotionsScreen from '../screens/PromotionsScreen';
import CampaignsScreen from '../screens/CampaignsScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Drawer = createDrawerNavigator<AdminDrawerParamList>();

function AppNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '600', fontSize: 18 },
        drawerStyle: { width: 280, backgroundColor: colors.primary },
        drawerType: 'front',
        overlayColor: colors.overlay,
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Bookings' }} />
      <Drawer.Screen name="Customers" component={CustomersScreen} options={{ title: 'Customers' }} />
      <Drawer.Screen name="Vehicles" component={VehiclesScreen} options={{ title: 'Vehicles' }} />
      <Drawer.Screen name="Services" component={ServicesScreen} options={{ title: 'Services' }} />
      <Drawer.Screen name="Promotions" component={PromotionsScreen} options={{ title: 'Promotions' }} />
      <Drawer.Screen name="Campaigns" component={CampaignsScreen} options={{ title: 'Campaigns' }} />
      <Drawer.Screen name="Statistics" component={StatisticsScreen} options={{ title: 'Statistics' }} />
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

  return isAuthenticated ? <AppNavigator /> : <LoginScreen />;
}
