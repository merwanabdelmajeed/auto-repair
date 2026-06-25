import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

const KPI_CARDS = [
  { label: "Today's Bookings", value: '0', icon: 'calendar-outline' as const, color: colors.primary, trend: '—' },
  { label: 'Active Customers', value: '0', icon: 'people-outline' as const, color: '#8B5CF6', trend: '—' },
  { label: 'Vehicles Registered', value: '0', icon: 'car-outline' as const, color: '#3B82F6', trend: '—' },
  { label: 'Appointments This Month', value: '0', icon: 'stats-chart-outline' as const, color: colors.success, trend: '—' },
];

const QUICK_LINKS = [
  { icon: 'calendar-outline' as const, label: 'View Bookings', screen: 'Bookings' },
  { icon: 'people-outline' as const, label: 'Customers', screen: 'Customers' },
  { icon: 'construct-outline' as const, label: 'Services', screen: 'Services' },
  { icon: 'settings-outline' as const, label: 'Settings', screen: 'Settings' },
];

export default function DashboardScreen({ navigation }: any) {
  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Location Context Banner */}
        <View style={styles.locationBanner}>
          <View style={styles.locationLeft}>
            <Ionicons name="location-outline" size={16} color={colors.secondary} />
            <Text style={styles.locationText}>Joe's Auto Repair — San Jose</Text>
          </View>
          <Ionicons name="chevron-down" size={14} color={colors.secondary} />
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          {KPI_CARDS.map((card) => (
            <View key={card.label} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: card.color + '15' }]}>
                <Ionicons name={card.icon} size={22} color={card.color} />
              </View>
              <Text style={styles.kpiValue}>{card.value}</Text>
              <Text style={styles.kpiLabel}>{card.label}</Text>
              <Text style={styles.kpiTrend}>{card.trend}</Text>
            </View>
          ))}
        </View>

        {/* Today's Schedule */}
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
          <Text style={styles.emptyText}>No appointments scheduled for today</Text>
          <Text style={styles.emptySubText}>
            Appointments will appear here once customers start booking
          </Text>
        </View>

        {/* Quick Links */}
        <Text style={styles.sectionTitle}>Quick Navigation</Text>
        <View style={styles.quickGrid}>
          {QUICK_LINKS.map((link) => (
            <View
              key={link.screen}
              style={styles.quickCard}
            >
              <View style={styles.quickIcon}>
                <Ionicons name={link.icon} size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickLabel}>{link.label}</Text>
            </View>
          ))}
        </View>

        {/* Phase Indicator */}
        <View style={styles.phaseCard}>
          <Ionicons name="rocket-outline" size={20} color={colors.secondary} style={{ marginRight: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.phaseTitle}>Phase 0 — Skeleton Complete</Text>
            <Text style={styles.phaseDesc}>
              Navigation, layouts, and placeholder screens are ready. Phase 1 will wire up the AWS backend.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  locationLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  locationText: {
    ...typography.bodySmall,
    color: colors.secondary,
    fontWeight: '600',
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  kpiIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  kpiValue: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  kpiLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  kpiTrend: {
    ...typography.small,
    color: colors.textMuted,
  },

  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyText: {
    ...typography.h4,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  phaseCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: borderRadius.lg,
    margin: spacing.md,
    padding: spacing.md,
  },
  phaseTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  phaseDesc: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
