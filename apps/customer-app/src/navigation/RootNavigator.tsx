import React, { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { CustomerDrawerParamList } from './types';
import { colors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import DrawerContent from '../components/DrawerContent';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

import HomeScreen from '../screens/HomeScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import VehiclesScreen from '../screens/VehiclesScreen';
import PromotionsScreen from '../screens/PromotionsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Drawer = createDrawerNavigator<CustomerDrawerParamList>();

function AppNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
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
      <Drawer.Screen name="Home" component={HomeScreen} options={{ title: 'AutoRepair Pro' }} />
      <Drawer.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Appointments' }} />
      <Drawer.Screen name="Vehicles" component={VehiclesScreen} options={{ title: 'My Vehicles' }} />
      <Drawer.Screen name="Promotions" component={PromotionsScreen} options={{ title: 'Promotions' }} />
      <Drawer.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [authScreen, setAuthScreen] = useState<'Login' | 'Register'>('Login');

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    if (authScreen === 'Register') {
      return <RegisterScreen onNavigateToLogin={() => setAuthScreen('Login')} />;
    }
    return <LoginScreen onNavigateToRegister={() => setAuthScreen('Register')} />;
  }

  return <AppNavigator />;
}
