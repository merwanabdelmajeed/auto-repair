import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import StatusPickerModal from '../components/StatusPickerModal';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { getDashboardSummary, type DashboardSummary } from '../api/dashboard';
import { listAppointments, updateAppointmentStatus, applyPromo, type Appointment, type AppointmentStatus } from '../api/appointments';

const VALID_NEXT: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  pending:       ['confirmed', 'cancelled'],
  confirmed:     ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
};

function statusLabel(s: AppointmentStatus) {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

const STATUS_COLOR: Record<AppointmentStatus, string> = {
  pending:       '#64748B',
  confirmed:     '#2563EB',
  'in-progress': '#D97706',
  completed:     colors.success,
  cancelled:     '#DC2626',
};

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function DashboardScreen({ navigation }: any) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingAppt, setUpdatingAppt] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Appointment | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const today = todayLocalDate();
    try {
      const [sum, appts] = await Promise.all([
        getDashboardSummary().catch(() => null as DashboardSummary | null),
        listAppointments().catch(() => [] as Appointment[]),
      ]);
      setSummary(sum);
      setTodaysAppointments(
        appts
          .filter(a => a.scheduledAt.startsWith(today) && a.status !== 'cancelled')
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleStatus(appt: Appointment, status: AppointmentStatus) {
    setUpdatingAppt(appt.appointmentId);
    try {
      await updateAppointmentStatus(appt.appointmentId, status);
      setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, status } : a));
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setUpdatingAppt(null);
    }
  }

  function openStatusPicker(appt: Appointment) {
    if (!VALID_NEXT[appt.status]) return;
    setStatusTarget(appt);
  }

  function handleStatusSelect(status: AppointmentStatus) {
    if (!statusTarget) return;
    const appt = statusTarget;
    if (status === 'cancelled') {
      Alert.alert(
        'Cancel Appointment',
        `Cancel "${appt.serviceName}" for ${appt.customerName || appt.customerEmail}?`,
        [
          { text: 'Keep', style: 'cancel' },
          { text: 'Cancel Appointment', style: 'destructive', onPress: () => void handleStatus(appt, 'cancelled') },
        ],
      );
    } else {
      void handleStatus(appt, status);
    }
  }

  function confirmApplyPromo(appt: Appointment) {
    Alert.alert('Apply Promo', `Mark "${appt.promoCode}" as applied for ${appt.customerName || appt.customerEmail}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Applied', onPress: async () => {
          if (!appt.promoId) return;
          setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: true } : a));
          try {
            await applyPromo(appt.promoId, appt.customerId, appt.appointmentId);
          } catch (err: unknown) {
            setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: false } : a));
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to apply promo.');
          }
        },
      },
    ]);
  }

  const kpis = [
    { label: "Today's Bookings", value: summary?.bookingsToday ?? 0, icon: 'calendar-outline' as const, color: colors.primary, clickable: false },
    { label: 'Total Customers',   value: summary?.totalCustomers ?? 0, icon: 'people-outline' as const,  color: '#8B5CF6', clickable: true, screen: 'Customers' },
    { label: 'Vehicles',          value: summary?.totalVehicles ?? 0, icon: 'car-outline' as const,     color: '#3B82F6', clickable: true, screen: 'Vehicles' },
  ];


  return (
    <Layout>
      <StatusPickerModal
        visible={statusTarget !== null}
        currentStatus={statusTarget?.status ?? 'pending'}
        validNext={statusTarget ? (VALID_NEXT[statusTarget.status] ?? []) : []}
        onSelect={handleStatusSelect}
        onDismiss={() => setStatusTarget(null)}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.secondary} />}
      >
        {/* Location Banner */}
        <View style={styles.locationBanner}>
          <View style={styles.locationLeft}>
            <Ionicons name="location-outline" size={16} color={colors.secondary} />
            <Text style={styles.locationText}>Admin Dashboard</Text>
          </View>
          {loading && <ActivityIndicator size="small" color={colors.secondary} />}
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          {kpis.map(card =>
            card.clickable ? (
              <TouchableOpacity
                key={card.label}
                style={styles.kpiCard}
                onPress={() => navigation?.navigate(card.screen)}
                activeOpacity={0.75}
              >
                <View style={[styles.kpiIcon, { backgroundColor: card.color + '18' }]}>
                  <Ionicons name={card.icon} size={22} color={card.color} />
                </View>
                <Text style={styles.kpiValue}>{loading ? '—' : String(card.value)}</Text>
                <Text style={styles.kpiLabel}>{card.label}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={{ position: 'absolute', top: 12, right: 12 }} />
              </TouchableOpacity>
            ) : (
              <View key={card.label} style={styles.kpiCard}>
                <View style={[styles.kpiIcon, { backgroundColor: card.color + '18' }]}>
                  <Ionicons name={card.icon} size={22} color={card.color} />
                </View>
                <Text style={styles.kpiValue}>{loading ? '—' : String(card.value)}</Text>
                <Text style={styles.kpiLabel}>{card.label}</Text>
              </View>
            )
          )}
        </View>

        {/* Today's Bookings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Bookings</Text>
          <TouchableOpacity onPress={() => navigation?.navigate('Bookings')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bookingsCard}>
          {loading ? (
            <View style={styles.bookingsEmpty}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : todaysAppointments.length === 0 ? (
            <View style={styles.bookingsEmpty}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
              <Text style={styles.bookingsEmptyText}>No bookings today</Text>
            </View>
          ) : todaysAppointments.map((a, i) => {
            const isUpdating = updatingAppt === a.appointmentId;
            return (
              <View key={a.appointmentId} style={[styles.bookingRow, i < todaysAppointments.length - 1 && styles.bookingRowBorder]}>
                <View style={styles.bookingRowTop}>
                  <Text style={styles.bookingTime}>{fmtTime(a.scheduledAt)}</Text>
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingName} numberOfLines={1}>{a.customerName || a.customerEmail}</Text>
                    <Text style={styles.bookingDetail} numberOfLines={1}>{a.serviceName} · {a.vehicleSummary}</Text>
                  </View>
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : VALID_NEXT[a.status] ? (
                    <TouchableOpacity onPress={() => openStatusPicker(a)} style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[a.status] + '18' }]} activeOpacity={0.7}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[a.status] }]}>{a.status} ▾</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[a.status] + '18' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLOR[a.status] }]}>{a.status}</Text>
                    </View>
                  )}
                </View>
                {a.promoCode && (
                  <View style={styles.promoRow}>
                    <Ionicons name="pricetag-outline" size={12} color={a.promoApplied ? colors.success : colors.secondary} />
                    <Text style={[styles.promoText, { color: a.promoApplied ? colors.success : colors.textSecondary }]}>
                      {a.promoCode}{a.promoApplied ? ' ✓' : ' — not applied'}
                    </Text>
                  </View>
                )}
                {a.promoCode && !a.promoApplied && !isUpdating && (
                  <View style={styles.bookingActions}>
                    <TouchableOpacity onPress={() => confirmApplyPromo(a)} style={styles.promoBtn} activeOpacity={0.8}>
                      <Text style={styles.promoBtnText}>Apply Promo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Quick Navigation */}
        <Text style={styles.sectionTitle}>Quick Navigation</Text>
        <View style={styles.quickGrid}>
          {([
            { icon: 'pricetag-outline' as const, label: 'Promotions', screen: 'Promotions' },
            { icon: 'construct-outline' as const, label: 'Services',   screen: 'Services' },
            { icon: 'settings-outline' as const, label: 'Settings',   screen: 'Settings' },
          ]).map(link => (
            <TouchableOpacity
              key={link.screen}
              style={styles.quickCard}
              onPress={() => navigation?.navigate(link.screen)}
              activeOpacity={0.75}
            >
              <View style={styles.quickIcon}>
                <Ionicons name={link.icon} size={26} color={colors.primary} />
              </View>
              <Text style={styles.quickLabel}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  locationBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 10 },
  locationLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  locationText: { ...typography.bodySmall, color: colors.secondary, fontWeight: '600' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm },
  kpiCard: { width: '47%', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, ...shadows.sm },
  kpiIcon: { width: 44, height: 44, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  kpiValue: { ...typography.h1, color: colors.textPrimary, marginBottom: 2, fontSize: 22 },
  kpiLabel: { ...typography.small, color: colors.textSecondary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.textPrimary },
  seeAll: { ...typography.small, color: colors.primary, fontWeight: '700' },

  bookingsCard: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.lg, borderRadius: borderRadius.lg, ...shadows.sm, overflow: 'hidden' },
  bookingsEmpty: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  bookingsEmptyText: { ...typography.body, color: colors.textMuted },

  bookingRow: { padding: spacing.md, gap: 6 },
  bookingRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  bookingRowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bookingTime: { ...typography.small, fontWeight: '700', color: colors.primary, minWidth: 52 },
  bookingInfo: { flex: 1, minWidth: 0 },
  bookingName: { ...typography.bodySmall, fontWeight: '700', color: colors.textPrimary },
  bookingDetail: { ...typography.small, color: colors.textMuted },
  statusBadge: { borderRadius: borderRadius.xs, paddingHorizontal: 7, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 56, marginTop: 2 },
  promoText: { fontSize: 11, fontWeight: '600' },
  bookingActions: { flexDirection: 'row', gap: spacing.xs, paddingLeft: 56, marginTop: 6, flexWrap: 'wrap' },
  actionBtn: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  promoBtn: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  promoBtnText: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  cancelBtn: { backgroundColor: 'rgba(239,68,68,0.06)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  cancelBtnText: { fontSize: 11, fontWeight: '700', color: colors.error },

  quickGrid: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.lg },
  quickCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  quickIcon: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  quickLabel: { ...typography.small, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
});
