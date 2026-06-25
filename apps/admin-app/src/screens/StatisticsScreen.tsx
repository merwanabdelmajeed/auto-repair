import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

const PERIOD_TABS = ['Day', 'Week', 'Month', 'Year'];
const METRICS = [
  { label: 'Appointments Scheduled', value: '0', icon: 'calendar-outline' as const, color: colors.primary },
  { label: 'Completed', value: '0', icon: 'checkmark-circle-outline' as const, color: colors.success },
  { label: 'Cancelled', value: '0', icon: 'close-circle-outline' as const, color: colors.error },
  { label: 'New Customers', value: '0', icon: 'person-add-outline' as const, color: '#8B5CF6' },
];

export default function StatisticsScreen() {
  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Period Selector */}
        <View style={styles.periodRow}>
          {PERIOD_TABS.map((tab, i) => (
            <TouchableOpacity key={tab} style={[styles.periodTab, i === 2 && styles.periodTabActive]}>
              <Text style={[styles.periodText, i === 2 && styles.periodTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          {METRICS.map((m) => (
            <View key={m.label} style={styles.kpiCard}>
              <View style={[styles.kpiIcon, { backgroundColor: m.color + '15' }]}>
                <Ionicons name={m.icon} size={20} color={m.color} />
              </View>
              <Text style={styles.kpiValue}>{m.value}</Text>
              <Text style={styles.kpiLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        {/* Chart Placeholder */}
        <Text style={styles.sectionTitle}>Appointments Over Time</Text>
        <View style={styles.chartPlaceholder}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.textMuted} />
          <Text style={styles.chartLabel}>Chart will render here in Phase 11</Text>
          <Text style={styles.chartSubLabel}>Daily/Weekly/Monthly appointment volume</Text>
        </View>

        {/* Top Services Placeholder */}
        <Text style={styles.sectionTitle}>Most Requested Services</Text>
        <View style={styles.emptyCard}>
          {['Oil Change', 'Brake Service', 'Tire Rotation', 'Diagnostics', 'Alignment'].map((s, i) => (
            <View key={s} style={styles.rankRow}>
              <Text style={styles.rank}>#{i + 1}</Text>
              <Text style={styles.rankLabel}>{s}</Text>
              <View style={styles.rankBar}>
                <View style={[styles.rankFill, { width: `${100 - i * 15}%`, backgroundColor: colors.primary + (80 - i * 12).toString(16) }]} />
              </View>
              <Text style={styles.rankValue}>0</Text>
            </View>
          ))}
        </View>

        {/* Busiest Times Placeholder */}
        <Text style={styles.sectionTitle}>Busiest Hours</Text>
        <View style={styles.chartPlaceholder}>
          <Ionicons name="time-outline" size={48} color={colors.textMuted} />
          <Text style={styles.chartLabel}>Heat map will render here in Phase 11</Text>
          <Text style={styles.chartSubLabel}>Visualizes peak booking hours by day</Text>
        </View>

        <View style={styles.reportingNote}>
          <Ionicons name="layers-outline" size={18} color={colors.secondary} style={{ marginRight: spacing.sm }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noteTitle}>Multi-Level Reporting</Text>
            <Text style={styles.noteDesc}>Statistics support Location, Tenant, and Multi-Location Aggregate views. Phase 11 wires this up fully.</Text>
          </View>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  periodRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: 4,
    ...shadows.sm,
  },
  periodTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.md },
  periodTabActive: { backgroundColor: colors.primary },
  periodText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  periodTextActive: { color: colors.white },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  kpiCard: { width: '47%', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, ...shadows.sm },
  kpiIcon: { width: 40, height: 40, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  kpiValue: { ...typography.h2, color: colors.textPrimary },
  kpiLabel: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  sectionTitle: { ...typography.h4, color: colors.textPrimary, paddingHorizontal: spacing.md, marginBottom: spacing.sm },

  chartPlaceholder: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartLabel: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.sm, fontWeight: '600' },
  chartSubLabel: { ...typography.small, color: colors.textMuted },

  emptyCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rank: { ...typography.label, color: colors.textMuted, width: 28 },
  rankLabel: { ...typography.bodySmall, color: colors.textPrimary, width: 120 },
  rankBar: { flex: 1, height: 6, backgroundColor: colors.background, borderRadius: 3, overflow: 'hidden', marginHorizontal: spacing.sm },
  rankFill: { height: '100%', borderRadius: 3 },
  rankValue: { ...typography.small, color: colors.textMuted, width: 20 },

  reportingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: borderRadius.lg,
    margin: spacing.md,
    padding: spacing.md,
  },
  noteTitle: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600', marginBottom: 4 },
  noteDesc: { ...typography.small, color: colors.textSecondary, lineHeight: 18 },
});
