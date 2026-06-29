import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import StatusPickerModal from '../components/StatusPickerModal';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  listAppointments,
  updateAppointmentStatus,
  applyPromo,
  type Appointment,
  type AppointmentStatus,
} from '../api/appointments';

const STATUS_TABS: { label: string; value: AppointmentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_COLOR: Record<AppointmentStatus, { bg: string; text: string }> = {
  pending: { bg: 'rgba(245,158,11,0.12)', text: '#D97706' },
  confirmed: { bg: 'rgba(59,130,246,0.12)', text: '#2563EB' },
  'in-progress': { bg: 'rgba(139,92,246,0.12)', text: '#7C3AED' },
  completed: { bg: 'rgba(34,197,94,0.12)', text: '#16A34A' },
  cancelled: { bg: 'rgba(148,163,184,0.12)', text: '#64748B' },
};

const VALID_NEXT: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  pending:       ['confirmed', 'cancelled'],
  confirmed:     ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
};

function statusLabel(s: AppointmentStatus) {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function BookingsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<AppointmentStatus | 'all'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Appointment | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await listAppointments();
      setAppointments(data);
    } catch {
      Alert.alert('Error', 'Failed to load appointments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleStatus(appt: Appointment, status: AppointmentStatus) {
    setUpdating(appt.appointmentId);
    try {
      await updateAppointmentStatus(appt.appointmentId, status);
      setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, status } : a));
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setUpdating(null);
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
    Alert.alert(
      'Apply Promo Code',
      `Mark code "${appt.promoCode}" as applied for ${appt.customerName || appt.customerEmail}? This records that the discount was given in person.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Applied', onPress: async () => {
            if (!appt.promoId) return;
            // Optimistic update — show applied immediately
            setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: true } : a));
            try {
              await applyPromo(appt.promoId, appt.customerId, appt.appointmentId);
            } catch (err: unknown) {
              // Revert on failure
              setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: false } : a));
              Alert.alert('Cannot Apply', err instanceof Error ? err.message : 'Failed to apply promo.');
            }
          },
        },
      ],
    );
  }

  const filtered = (activeTab === 'all' ? appointments : appointments.filter(a => a.status === activeTab))
    .slice()
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <Layout>
      <StatusPickerModal
        visible={statusTarget !== null}
        currentStatus={statusTarget?.status ?? 'pending'}
        validNext={statusTarget ? (VALID_NEXT[statusTarget.status] ?? []) : []}
        onSelect={handleStatusSelect}
        onDismiss={() => setStatusTarget(null)}
      />
      {/* Status Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsScroll}>
        {STATUS_TABS.map(tab => {
          const count = tab.value === 'all' ? appointments.length : appointments.filter(a => a.status === tab.value).length;
          const active = activeTab === tab.value;
          return (
            <TouchableOpacity key={tab.value} onPress={() => setActiveTab(tab.value)} style={[styles.tab, active && styles.tabActive]} activeOpacity={0.7}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.secondary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{activeTab === 'all' ? 'No Appointments Yet' : `No ${activeTab} appointments`}</Text>
              <Text style={styles.emptyDesc}>Appointments appear here when customers book through the app.</Text>
            </View>
          ) : filtered.map(appt => {
            const sc = STATUS_COLOR[appt.status];
            const isUpdating = updating === appt.appointmentId;
            return (
              <View key={appt.appointmentId} style={styles.card}>
                {/* Card Header */}
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{appt.serviceName}</Text>
                    <Text style={styles.customerEmail}>{appt.customerName || appt.customerEmail}</Text>
                  </View>
                  {isUpdating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : VALID_NEXT[appt.status] ? (
                    <TouchableOpacity onPress={() => openStatusPicker(appt)} style={[styles.statusBadge, { backgroundColor: sc.bg }]} activeOpacity={0.7}>
                      <Text style={[styles.statusText, { color: sc.text }]}>{appt.status} ▾</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>{appt.status}</Text>
                    </View>
                  )}
                </View>

                {/* Details */}
                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="car-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.detailText}>{appt.vehicleSummary}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.detailText}>{fmtDate(appt.scheduledAt)}</Text>
                  </View>
                  {appt.promoCode && (
                    <View style={styles.detailRow}>
                      <Ionicons name="pricetag-outline" size={14} color={appt.promoApplied ? colors.success : colors.secondary} />
                      <Text style={[styles.detailText, { color: appt.promoApplied ? colors.success : colors.textSecondary }]}>
                        {appt.promoCode}{appt.promoApplied ? ' ✓ Applied' : ' — not yet applied'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                {appt.promoCode && !appt.promoApplied && !isUpdating && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => confirmApplyPromo(appt)} style={styles.promoBtn} activeOpacity={0.8}>
                      <Ionicons name="pricetag-outline" size={13} color={colors.secondary} />
                      <Text style={styles.promoBtnText}>Apply Promo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Layout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },

  tabsScroll: { maxHeight: 52, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabs: { paddingHorizontal: spacing.md, alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: borderRadius.round, borderWidth: 1, borderColor: colors.border, gap: 6, backgroundColor: colors.background },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.white },
  tabBadge: { backgroundColor: colors.surface, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 1 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  tabBadgeTextActive: { color: colors.white },

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },

  card: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  serviceName: { ...typography.h4, color: colors.textPrimary, marginBottom: 2 },
  customerEmail: { ...typography.small, color: colors.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  cardDetails: { gap: 5, marginBottom: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { ...typography.small, color: colors.textSecondary },

  cardActions: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm },
  advanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(15,32,68,0.07)', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  advanceBtnText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  cancelBtn: { borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  cancelBtnText: { fontSize: 12, color: colors.error, fontWeight: '600' },
  promoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  promoBtnText: { fontSize: 12, color: colors.secondary, fontWeight: '600' },
});
