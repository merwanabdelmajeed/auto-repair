import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { getAnalytics, type AnalyticsResponse, type ServiceData } from '../api/analytics';

type Period = '7d' | '30d' | '90d';

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

function periodRange(period: Period): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (period === '7d' ? 6 : period === '30d' ? 29 : 89));
  return { start: toDateStr(start), end: toDateStr(end) };
}


const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  cancelled: '#ef4444',
  'no-show': '#94a3b8',
};


export default function StatisticsScreen() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setError('');
    const { start, end } = periodRange(p);
    try {
      setData(await getAnalytics(start, end));
    } catch {
      setError('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(period); }, [load, period]));

  function changePeriod(p: Period) {
    setPeriod(p);
  }

  const maxSvc = data ? Math.max(...data.byService.map(s => s.bookings), 1) : 1;

  const PERIODS: { key: Period; label: string }[] = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '3 Months' },
  ];

  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Period tabs */}
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodTab, period === p.key && styles.periodTabActive]}
              onPress={() => changePeriod(p.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodTabText, period === p.key && styles.periodTabTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <View key={i} style={[styles.kpiCard, styles.kpiSkeleton]} />
            ))
          ) : data ? (
            <>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Bookings</Text>
                <Text style={styles.kpiValue}>{data.summary.totalBookings}</Text>
                <Text style={styles.kpiSub}>{data.summary.completedBookings} completed</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Customers</Text>
                <Text style={styles.kpiValue}>{data.summary.uniqueCustomers}</Text>
                <Text style={styles.kpiSub}>{data.summary.newCustomers} new</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Returning</Text>
                <Text style={styles.kpiValue}>{data.summary.returningCustomers}</Text>
                <Text style={styles.kpiSub}>repeat customers</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Service popularity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Popularity</Text>
          {loading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : data && data.byService.length > 0 ? (
            data.byService.slice(0, 6).map((svc: ServiceData) => {
              const pct = maxSvc > 0 ? (svc.bookings / maxSvc) * 100 : 0;
              return (
                <View key={svc.serviceId} style={styles.svcRow}>
                  <View style={styles.svcInfo}>
                    <Text style={styles.svcName} numberOfLines={1}>{svc.serviceName}</Text>
                    <Text style={styles.svcMeta}>
                      {svc.bookings} booking{svc.bookings !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.svcBarTrack}>
                    <View style={[styles.svcBarFill, { width: `${pct}%` as unknown as number }]} />
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No bookings in this period</Text>
          )}
        </View>

        {/* Status breakdown */}
        <View style={[styles.section, { marginBottom: spacing.xl }]}>
          <Text style={styles.sectionTitle}>By Status</Text>
          {loading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : data && data.summary.totalBookings > 0 ? (
            Object.entries(data.byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = Math.round((count / data.summary.totalBookings) * 100);
                const color = STATUS_COLORS[status] ?? '#94a3b8';
                const label = status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
                return (
                  <View key={status} style={styles.statusRow}>
                    <View style={styles.statusLabelRow}>
                      <View style={[styles.statusDot, { backgroundColor: color }]} />
                      <Text style={styles.statusLabel}>{label}</Text>
                      <Text style={styles.statusCount}>{count} ({pct}%)</Text>
                    </View>
                    <View style={styles.svcBarTrack}>
                      <View style={[styles.svcBarFill, { width: `${pct}%` as unknown as number, backgroundColor: color }]} />
                    </View>
                  </View>
                );
              })
          ) : (
            <Text style={styles.emptyText}>No bookings in this period</Text>
          )}
        </View>

      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  periodRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    ...shadows.sm,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  periodTabActive: {
    backgroundColor: colors.primary,
  },
  periodTabText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  periodTabTextActive: {
    color: colors.white,
  },

  errorBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  errorText: { ...typography.bodySmall, color: colors.error },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  kpiSkeleton: {
    minHeight: 80,
    opacity: 0.4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 28,
    marginBottom: 2,
  },
  kpiSub: {
    ...typography.small,
    color: colors.textSecondary,
  },

  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },

  emptyText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },

  svcRow: {
    marginBottom: spacing.sm,
  },
  svcInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  svcName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  svcMeta: {
    ...typography.small,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  svcBarTrack: {
    height: 5,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  svcBarFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 3,
  },

  statusRow: {
    marginBottom: spacing.sm,
  },
  statusLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  statusCount: {
    ...typography.small,
    color: colors.textSecondary,
  },

  loadingOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
});
