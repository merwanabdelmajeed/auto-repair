import React, { useState } from 'react';
import { SHOP_NAME } from '../constants';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { CustomerDrawerParamList } from './types';
import { colors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import DrawerContent from '../components/DrawerContent';
import { NotificationsProvider, useNotifications } from '../contexts/NotificationsContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Ionicons } from '@expo/vector-icons';

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

function NotificationBell({ navigation }: { navigation: any }) {
  const { unreadCount } = useNotifications();
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications')}
      style={{ marginRight: 16, position: 'relative' }}
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
            {unreadCount > 9 ? '9+' : unreadCount}
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
      initialRouteName="Home"
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
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => (
            <View>
              <Text style={{ color: colors.white, fontWeight: '700', fontSize: 17 }}>{SHOP_NAME}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Your trusted auto service partner</Text>
            </View>
          ),
        }}
      />
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

  return (
    <NotificationsProvider>
      <AppNavigator />
    </NotificationsProvider>
  );
}
