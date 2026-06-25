import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export default function CustomersScreen() {
  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
          <Text style={styles.searchPlaceholder}>Search customers by name or email…</Text>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="filter-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Total', value: '0' },
            { label: 'New This Month', value: '0' },
            { label: 'Active', value: '0' },
          ].map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={52} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Customers Yet</Text>
          <Text style={styles.emptyDesc}>
            Customer profiles are created automatically when someone registers through the customer app.
          </Text>
        </View>

        <View style={styles.fieldsCard}>
          <Text style={styles.fieldsTitle}>Customer Profile Fields</Text>
          {['Full Name', 'Email Address', 'Phone Number', 'Preferred Location', 'Vehicles (linked)', 'Appointment History'].map((field) => (
            <View key={field} style={styles.fieldRow}>
              <Ionicons name="person-outline" size={14} color={colors.primary} style={{ marginRight: spacing.sm }} />
              <Text style={styles.fieldText}>{field}</Text>
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
  searchPlaceholder: { ...typography.body, color: colors.textMuted, flex: 1 },
  filterBtn: { padding: spacing.xs },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: { ...typography.h2, color: colors.textPrimary },
  statLabel: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  fieldsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  fieldsTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
  fieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  fieldText: { ...typography.bodySmall, color: colors.textSecondary },

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
