import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, RefreshControl, Modal,
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
import { listCustomers, type Customer } from '../api/customers';
import { listVehicles, updateVehicle, type Vehicle } from '../api/vehicles';

type BookingsTab = AppointmentStatus | 'current' | 'past';

const STATUS_TABS: { label: string; value: BookingsTab }[] = [
  { label: 'Current', value: 'current' },
  { label: 'Past', value: 'past' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

function todayLocalDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BookingsScreen({ route, navigation }: any) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
  const [vehicleMap, setVehicleMap] = useState<Record<string, Vehicle>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<BookingsTab>('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Appointment | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [showVehicleDetail, setShowVehicleDetail] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [editPlate, setEditPlate] = useState('');
  const [editVin, setEditVin] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [vehicleEditError, setVehicleEditError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [appts, customers, vehicles] = await Promise.all([listAppointments(), listCustomers(), listVehicles()]);
      setAppointments(appts);
      const cmap: Record<string, Customer> = {};
      customers.forEach(c => { cmap[c.userId] = c; });
      setCustomerMap(cmap);
      const vmap: Record<string, Vehicle> = {};
      vehicles.forEach(v => { vmap[v.vehicleId] = v; });
      setVehicleMap(vmap);
    } catch {
      Alert.alert('Error', 'Failed to load appointments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Auto-open the detail modal when arriving from a notification tap, then
  // clear the param so it doesn't reopen on a later, unrelated screen focus.
  useEffect(() => {
    const targetId = route?.params?.appointmentId;
    if (!targetId) return;
    const match = appointments.find(a => a.appointmentId === targetId);
    if (match) {
      setDetailAppt(match);
      navigation.setParams({ appointmentId: undefined });
    }
  }, [appointments, route?.params?.appointmentId]);

  function openDetail(appt: Appointment) {
    setDetailAppt(appt);
    setShowVehicleDetail(false);
    setEditingVehicle(false);
    setVehicleEditError('');
  }

  async function handleStatus(appt: Appointment, status: AppointmentStatus) {
    setUpdating(appt.appointmentId);
    try {
      await updateAppointmentStatus(appt.appointmentId, status);
      setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, status } : a));
      setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, status } : prev);
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
    setStatusTarget(null);
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
            setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: true } : a));
            setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, promoApplied: true } : prev);
            try {
              await applyPromo(appt.promoId, appt.customerId, appt.appointmentId);
            } catch (err: unknown) {
              setAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: false } : a));
              setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, promoApplied: false } : prev);
              Alert.alert('Cannot Apply', err instanceof Error ? err.message : 'Failed to apply promo.');
            }
          },
        },
      ],
    );
  }

  async function saveVehicleEdit(veh: Vehicle) {
    setSavingVehicle(true);
    setVehicleEditError('');
    try {
      const updated = await updateVehicle(veh.vehicleId, {
        licensePlate: editPlate.trim() || undefined,
        vin: editVin.trim() || undefined,
      });
      setVehicleMap(prev => ({ ...prev, [veh.vehicleId]: { ...veh, ...updated } }));
      setEditingVehicle(false);
    } catch {
      setVehicleEditError('Failed to save.');
    } finally {
      setSavingVehicle(false);
    }
  }

  const today = todayLocalDateStr();
  const currentAppts = appointments.filter(a => a.scheduledAt.slice(0, 10) >= today);
  const pastAppts = appointments.filter(a => a.scheduledAt.slice(0, 10) < today);

  function tabCount(tab: BookingsTab): number {
    if (tab === 'current') return currentAppts.length;
    if (tab === 'past') return pastAppts.length;
    return currentAppts.filter(a => a.status === tab).length;
  }

  function matchesSearch(appt: Appointment): boolean {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const customer = customerMap[appt.customerId];
    return (
      appt.serviceName.toLowerCase().includes(q) ||
      (appt.customerName ?? '').toLowerCase().includes(q) ||
      appt.customerEmail.toLowerCase().includes(q) ||
      (appt.vehicleSummary ?? '').toLowerCase().includes(q) ||
      (customer?.phone ?? '').toLowerCase().includes(q)
    );
  }

  const base = activeTab === 'current' ? currentAppts
    : activeTab === 'past' ? pastAppts
    : currentAppts.filter(a => a.status === activeTab);

  const filtered = base
    .filter(matchesSearch)
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

      {/* Search bar */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search service, customer, vehicle…"
          placeholderTextColor={colors.textMuted}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Status Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsScroll}>
        {STATUS_TABS.map(tab => {
          const count = tabCount(tab.value);
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
              <Text style={styles.emptyTitle}>{activeTab === 'current' ? 'No Upcoming Appointments' : activeTab === 'past' ? 'No Past Appointments' : `No ${activeTab} appointments`}</Text>
              <Text style={styles.emptyDesc}>Appointments appear here when customers book through the app.</Text>
            </View>
          ) : filtered.map(appt => {
            const sc = STATUS_COLOR[appt.status];
            const isUpdating = updating === appt.appointmentId;
            return (
              <TouchableOpacity key={appt.appointmentId} style={styles.card} onPress={() => openDetail(appt)} activeOpacity={0.85}>
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
                {appt.promoCode && !appt.promoApplied && !isUpdating && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => confirmApplyPromo(appt)} style={styles.promoBtn} activeOpacity={0.8}>
                      <Ionicons name="pricetag-outline" size={13} color={colors.secondary} />
                      <Text style={styles.promoBtnText}>Apply Promo</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal visible={!!detailAppt} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {detailAppt && (() => {
              const sc = STATUS_COLOR[detailAppt.status];
              const customer = customerMap[detailAppt.customerId];
              const veh = vehicleMap[detailAppt.vehicleId];
              const isUpdating = updating === detailAppt.appointmentId;
              return (
                <>
                  <View style={styles.modalHeader}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={styles.modalTitle} numberOfLines={2}>{detailAppt.serviceName}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg, alignSelf: 'flex-start', marginTop: 4 }]}>
                        <Text style={[styles.statusText, { color: sc.text }]}>{statusLabel(detailAppt.status)}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => setDetailAppt(null)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
                    {/* Customer section */}
                    <Text style={styles.sectionLabel}>Customer</Text>
                    <View style={styles.infoCard}>
                      {detailAppt.customerName ? (
                        <View style={styles.infoRow}>
                          <Ionicons name="person-outline" size={15} color={colors.textMuted} />
                          <Text style={styles.infoValue}>{detailAppt.customerName}</Text>
                        </View>
                      ) : null}
                      <View style={styles.infoRow}>
                        <Ionicons name="mail-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.infoValue}>{detailAppt.customerEmail}</Text>
                      </View>
                      {customer?.phone ? (
                        <View style={[styles.infoRow, styles.infoRowLast]}>
                          <Ionicons name="call-outline" size={15} color={colors.textMuted} />
                          <Text style={styles.infoValue}>{customer.phone}</Text>
                        </View>
                      ) : <View style={styles.infoRowLast} />}
                    </View>

                    {/* Appointment section */}
                    <Text style={styles.sectionLabel}>Appointment</Text>
                    <View style={styles.infoCard}>
                      {/* Vehicle row — tappable toggle */}
                      <TouchableOpacity
                        style={[styles.infoRow, { alignItems: 'center' }]}
                        onPress={() => setShowVehicleDetail(v => !v)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="car-outline" size={15} color={colors.primary} />
                        <Text style={[styles.infoValue, { color: colors.primary, fontWeight: '600' }]}>{detailAppt.vehicleSummary}</Text>
                        <Ionicons name={showVehicleDetail ? 'chevron-down' : 'chevron-forward'} size={14} color={colors.textMuted} />
                      </TouchableOpacity>

                      {/* Expanded vehicle detail */}
                      {showVehicleDetail && veh && (
                        <View style={styles.vehicleExpanded}>
                          <View style={styles.vehicleFieldRow}>
                            <Text style={styles.vehicleFieldLabel}>Plate</Text>
                            {editingVehicle
                              ? <TextInput style={styles.vehicleInput} value={editPlate} onChangeText={t => setEditPlate(t.toUpperCase())} placeholder="e.g. ABC1234" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                              : <Text selectable style={[styles.vehicleFieldValue, styles.vehicleMonoValue, !veh.licensePlate && { color: colors.textMuted }]}>{veh.licensePlate || '—'}</Text>}
                          </View>
                          <View style={styles.vehicleFieldRow}>
                            <Text style={styles.vehicleFieldLabel}>Color</Text>
                            <Text selectable style={styles.vehicleFieldValue}>{veh.color}</Text>
                          </View>
                          <View style={styles.vehicleFieldRow}>
                            <Text style={styles.vehicleFieldLabel}>VIN</Text>
                            {editingVehicle
                              ? <TextInput style={styles.vehicleInput} value={editVin} onChangeText={t => setEditVin(t.toUpperCase())} placeholder="17-char VIN" placeholderTextColor={colors.textMuted} autoCapitalize="characters" />
                              : <Text selectable style={[styles.vehicleFieldValue, styles.vehicleMonoValue, !veh.vin && { color: colors.textMuted }]}>{veh.vin || '—'}</Text>}
                          </View>
                          <View style={styles.vehicleFieldRow}>
                            <Text style={styles.vehicleFieldLabel}>Added</Text>
                            <Text selectable style={styles.vehicleFieldValue}>{fmtDateOnly(veh.createdAt)}</Text>
                          </View>
                          {vehicleEditError ? <Text style={styles.vehicleEditError}>{vehicleEditError}</Text> : null}
                          {editingVehicle ? (
                            <View style={styles.vehicleEditActions}>
                              <TouchableOpacity onPress={() => void saveVehicleEdit(veh)} disabled={savingVehicle} style={styles.vehicleSaveBtn} activeOpacity={0.8}>
                                {savingVehicle
                                  ? <ActivityIndicator size="small" color={colors.white} />
                                  : <Text style={styles.vehicleSaveBtnText}>Save</Text>}
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => { setEditingVehicle(false); setVehicleEditError(''); }} style={styles.vehicleCancelBtn} activeOpacity={0.8}>
                                <Text style={styles.vehicleCancelBtnText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity onPress={() => { setEditPlate(veh.licensePlate || ''); setEditVin(veh.vin || ''); setEditingVehicle(true); setVehicleEditError(''); }} style={styles.vehicleEditBtn} activeOpacity={0.8}>
                              <Ionicons name="pencil-outline" size={13} color={colors.primary} />
                              <Text style={styles.vehicleEditBtnText}>Edit Plate / VIN</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.infoValue}>{fmtDate(detailAppt.scheduledAt)}</Text>
                      </View>
                      {detailAppt.notes ? (
                        <View style={styles.infoRow}>
                          <Ionicons name="document-text-outline" size={15} color={colors.textMuted} />
                          <Text style={styles.infoValue}>{detailAppt.notes}</Text>
                        </View>
                      ) : null}
                      {detailAppt.promoCode ? (
                        <View style={styles.infoRow}>
                          <Ionicons name="pricetag-outline" size={15} color={detailAppt.promoApplied ? colors.success : colors.secondary} />
                          <Text style={[styles.infoValue, { color: detailAppt.promoApplied ? colors.success : colors.textPrimary }]}>
                            {detailAppt.promoCode}{detailAppt.promoApplied ? ' ✓ Applied' : ' — not yet applied'}
                          </Text>
                        </View>
                      ) : null}
                      <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Ionicons name="receipt-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.infoValue}>Booked {fmtDate(detailAppt.createdAt)}</Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.detailActions}>
                      {VALID_NEXT[detailAppt.status] && (
                        <TouchableOpacity onPress={() => openStatusPicker(detailAppt)} style={styles.detailActionBtn} activeOpacity={0.8} disabled={isUpdating}>
                          {isUpdating
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <><Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} /><Text style={styles.detailActionText}>Change Status</Text></>}
                        </TouchableOpacity>
                      )}
                      {detailAppt.promoCode && !detailAppt.promoApplied && !isUpdating && (
                        <TouchableOpacity onPress={() => confirmApplyPromo(detailAppt)} style={[styles.detailActionBtn, styles.detailPromoBtn]} activeOpacity={0.8}>
                          <Ionicons name="pricetag-outline" size={16} color={colors.secondary} />
                          <Text style={[styles.detailActionText, { color: colors.secondary }]}>Apply Promo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },

  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: 2, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, paddingVertical: 8 },

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
  promoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  promoBtnText: { fontSize: 12, color: colors.secondary, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  modalTitle: { ...typography.h3, color: colors.textPrimary },

  sectionLabel: { ...typography.label, color: colors.textMuted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: spacing.md },
  infoCard: { backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoRowLast: { borderBottomWidth: 0 },
  infoValue: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },

  vehicleExpanded: { backgroundColor: 'rgba(15,32,68,0.03)', borderBottomWidth: 1, borderBottomColor: colors.divider, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  vehicleFieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vehicleFieldLabel: { fontSize: 11, color: colors.textMuted, width: 44, flexShrink: 0 },
  vehicleFieldValue: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  vehicleMonoValue: { fontFamily: 'monospace' },
  vehicleInput: { flex: 1, borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5, fontSize: 13, color: colors.textPrimary },
  vehicleEditError: { fontSize: 12, color: colors.error, marginTop: 2 },
  vehicleEditActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  vehicleSaveBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.sm, paddingVertical: 8, alignItems: 'center' },
  vehicleSaveBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  vehicleCancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, paddingVertical: 8, alignItems: 'center' },
  vehicleCancelBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  vehicleEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: spacing.xs, borderWidth: 1, borderColor: 'rgba(15,32,68,0.3)', borderRadius: borderRadius.sm, paddingVertical: 5, paddingHorizontal: spacing.sm },
  vehicleEditBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

  detailActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  detailActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingVertical: 12, backgroundColor: colors.background },
  detailActionText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  detailPromoBtn: { borderColor: 'rgba(245,158,11,0.4)' },
});
