import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

const SETTINGS = [
  {
    title: 'Location',
    items: [
      { type: 'link' as const, icon: 'business-outline' as const, label: 'Business Information', value: 'Joe\'s Auto Repair' },
      { type: 'link' as const, icon: 'location-outline' as const, label: 'Manage Locations', value: '1 location' },
      { type: 'link' as const, icon: 'time-outline' as const, label: 'Business Hours', value: 'Configure' },
    ],
  },
  {
    title: 'Booking',
    items: [
      { type: 'link' as const, icon: 'people-outline' as const, label: 'Capacity Settings', value: 'Phase 7' },
      { type: 'link' as const, icon: 'ban-outline' as const, label: 'Blocked Times', value: 'Phase 8' },
      { type: 'toggle' as const, icon: 'calendar-outline' as const, label: 'Accept Online Bookings', value: true },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { type: 'toggle' as const, icon: 'notifications-outline' as const, label: 'Booking Alerts', value: true },
      { type: 'toggle' as const, icon: 'mail-outline' as const, label: 'Email Summaries', value: false },
    ],
  },
  {
    title: 'Account',
    items: [
      { type: 'link' as const, icon: 'person-outline' as const, label: 'Admin Profile', value: '' },
      { type: 'link' as const, icon: 'key-outline' as const, label: 'Change Password', value: '' },
      { type: 'link' as const, icon: 'log-out-outline' as const, label: 'Sign Out', value: '' },
    ],
  },
];

export default function SettingsScreen() {
  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tenant/Location Banner */}
        <View style={styles.tenantBanner}>
          <View style={styles.tenantAvatar}>
            <Ionicons name="business" size={24} color={colors.secondary} />
          </View>
          <View style={styles.tenantInfo}>
            <Text style={styles.tenantName}>Joe's Auto Repair</Text>
            <Text style={styles.tenantRole}>Tenant Owner · San Jose</Text>
          </View>
          <TouchableOpacity>
            <Ionicons name="pencil-outline" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {SETTINGS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.row, i === section.items.length - 1 && styles.rowLast]}
                  activeOpacity={item.type === 'link' ? 0.7 : 1}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name={item.icon} size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.type === 'toggle' ? (
                    <Switch
                      value={item.value as boolean}
                      thumbColor={colors.white}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      onValueChange={() => {}}
                    />
                  ) : (
                    <View style={styles.rowRight}>
                      {item.value ? <Text style={styles.rowValue}>{item.value}</Text> : null}
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.version}>AutoRepair Admin · Phase 0 · v1.0.0</Text>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  tenantBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  tenantAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  tenantInfo: { flex: 1 },
  tenantName: { ...typography.h3, color: colors.white, marginBottom: 2 },
  tenantRole: { ...typography.small, color: 'rgba(255,255,255,0.6)' },

  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rowLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...typography.bodySmall, color: colors.textSecondary },

  version: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
