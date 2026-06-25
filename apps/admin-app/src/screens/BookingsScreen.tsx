import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

const STATUS_TABS = ['All', 'Scheduled', 'Confirmed', 'Completed', 'Cancelled'];

export default function BookingsScreen() {
  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar Placeholder */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
          <Text style={styles.searchPlaceholder}>Search bookings by customer, date…</Text>
        </View>

        {/* Status Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {STATUS_TABS.map((tab, i) => (
            <View key={tab} style={[styles.tab, i === 0 && styles.tabActive]}>
              <Text style={[styles.tabText, i === 0 && styles.tabTextActive]}>{tab}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Date Filter */}
        <View style={styles.dateFilter}>
          <TouchableOpacity style={styles.dateBtn}>
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.datePill}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={styles.dateText}>Today — Jun 24, 2026</Text>
          </View>
          <TouchableOpacity style={styles.dateBtn}>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Empty State */}
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={52} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Bookings Found</Text>
          <Text style={styles.emptyDesc}>
            Bookings will appear here once customers start scheduling appointments.
          </Text>
        </View>

        {/* Booking Fields Reference */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Each Booking Includes</Text>
          {['Customer Name & Contact', 'Vehicle (Make / Model / Year)', 'Requested Service(s)', 'Date & Time Slot', 'Notes', 'Status (Scheduled → Confirmed → Completed)'].map((field) => (
            <View key={field} style={styles.infoRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginRight: spacing.sm }} />
              <Text style={styles.infoText}>{field}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  searchPlaceholder: {
    ...typography.body,
    color: colors.textMuted,
  },

  tabs: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: { color: colors.white },

  dateFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  dateBtn: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    ...shadows.sm,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: spacing.xs,
    ...shadows.sm,
  },
  dateText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  infoCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  infoTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});
