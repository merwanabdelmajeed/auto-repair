import React, { useEffect, useState } from 'react';
import { SHOP_NAME, SHOP_CITY } from '../constants';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
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
import VerifyEmailScreen from '../screens/VerifyEmailScreen';

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
  const { requireAuth } = useAuth();
  return (
    <TouchableOpacity
      onPress={() => requireAuth(() => navigation.navigate('Notifications'))}
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
  const { isAuthenticated } = useAuth();
  usePushNotifications(isAuthenticated);

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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.1)',
                justifyContent: 'center', alignItems: 'center',
                marginRight: 10,
              }}>
                <Ionicons name="construct" size={20} color={colors.secondary} />
              </View>
              <View>
                <Text style={{ color: colors.white, fontWeight: '700', fontSize: 17 }}>{SHOP_NAME}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Your trusted auto service in {SHOP_CITY}</Text>
              </View>
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
  const { isLoading, authPromptVisible, hideAuthPrompt } = useAuth();
  const [authScreen, setAuthScreen] = useState<'Login' | 'Register' | 'VerifyEmail'>('Login');
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');

  // Always start a freshly-opened prompt on Login, not wherever a previously
  // cancelled attempt left off.
  useEffect(() => {
    if (authPromptVisible) setAuthScreen('Login');
  }, [authPromptVisible]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NotificationsProvider>
      <AppNavigator />
      {authPromptVisible && (
        <View style={styles.overlay}>
          <View style={styles.overlayHeader}>
            <TouchableOpacity testID="auth-overlay-close" onPress={hideAuthPrompt} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {authScreen === 'VerifyEmail' ? (
            <VerifyEmailScreen
              email={pendingEmail}
              password={pendingPassword}
              onVerified={() => setAuthScreen('Login')}
              onNavigateToLogin={() => setAuthScreen('Login')}
            />
          ) : authScreen === 'Register' ? (
            <RegisterScreen
              onNavigateToLogin={() => setAuthScreen('Login')}
              onRegistered={(email, password) => {
                setPendingEmail(email);
                setPendingPassword(password);
                setAuthScreen('VerifyEmail');
              }}
            />
          ) : (
            <LoginScreen onNavigateToRegister={() => setAuthScreen('Register')} />
          )}
        </View>
      )}
    </NotificationsProvider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  overlayHeader: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
});
