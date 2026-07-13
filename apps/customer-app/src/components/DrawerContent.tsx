import React from 'react';
import { SHOP_NAME, SHOP_CITY } from '../constants';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

type DrawerItem = {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

const DRAWER_ITEMS: DrawerItem[] = [
  { name: 'Home', icon: 'home-outline', label: 'Home' },
  { name: 'Appointments', icon: 'calendar-outline', label: 'Appointments' },
  { name: 'Vehicles', icon: 'car-outline', label: 'My Vehicles' },
  { name: 'Promotions', icon: 'pricetag-outline', label: 'Promotions' },
  { name: 'Notifications', icon: 'notifications-outline', label: 'Notifications' },
  { name: 'Profile', icon: 'person-outline', label: 'Profile' },
  { name: 'Settings', icon: 'settings-outline', label: 'Settings' },
];

export default function DrawerContent(props: DrawerContentComponentProps) {
  const { navigation, state } = props;
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="construct" size={30} color={colors.secondary} />
        </View>
        <Text style={styles.appName}>{SHOP_NAME}</Text>
        <Text style={styles.tagline}>
          {SHOP_CITY ? `Your trusted auto service in ${SHOP_CITY}` : 'Your trusted auto service'}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.nav}>
        {DRAWER_ITEMS.map((item) => {
          const isActive = activeRouteName === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigation.navigate(item.name)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
                <Ionicons
                  name={item.icon}
                  size={21}
                  color={isActive ? colors.secondary : 'rgba(255,255,255,0.55)'}
                />
              </View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.divider} />
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.primary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },
  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    color: colors.white,
    ...typography.h3,
    marginBottom: 4,
  },
  tagline: {
    color: 'rgba(255,255,255,0.5)',
    ...typography.small,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: spacing.lg,
  },
  nav: {
    paddingVertical: spacing.sm,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconContainerActive: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  navLabel: {
    ...typography.body,
    color: 'rgba(255,255,255,0.6)',
    flex: 1,
  },
  navLabelActive: {
    color: colors.white,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: colors.secondary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: spacing.lg,
  },
  versionText: {
    ...typography.small,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
