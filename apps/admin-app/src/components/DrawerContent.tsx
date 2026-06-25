import React from 'react';
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
  { name: 'Dashboard', icon: 'grid-outline', label: 'Dashboard' },
  { name: 'Bookings', icon: 'calendar-outline', label: 'Bookings' },
  { name: 'Customers', icon: 'people-outline', label: 'Customers' },
  { name: 'Vehicles', icon: 'car-outline', label: 'Vehicles' },
  { name: 'Services', icon: 'construct-outline', label: 'Services' },
  { name: 'Promotions', icon: 'pricetag-outline', label: 'Promotions' },
  { name: 'Campaigns', icon: 'megaphone-outline', label: 'Campaigns' },
  { name: 'Statistics', icon: 'bar-chart-outline', label: 'Statistics' },
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
          <Ionicons name="construct" size={28} color={colors.secondary} />
        </View>
        <Text style={styles.appName}>AutoRepair Admin</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>ADMIN PORTAL</Text>
        </View>
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
                  size={20}
                  color={isActive ? colors.secondary : 'rgba(255,255,255,0.5)'}
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
        <Text style={styles.versionText}>Admin · Phase 0 · v1.0.0</Text>
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  appName: {
    color: colors.white,
    ...typography.h3,
    marginBottom: spacing.xs,
  },
  roleBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  roleText: {
    ...typography.small,
    color: colors.secondary,
    fontWeight: '700',
    letterSpacing: 0.8,
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
    paddingVertical: 12,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  iconContainer: {
    width: 34,
    height: 34,
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
    color: 'rgba(255,255,255,0.55)',
    flex: 1,
  },
  navLabelActive: {
    color: colors.white,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
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
