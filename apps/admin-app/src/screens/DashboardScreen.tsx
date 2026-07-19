import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import StatusPickerModal from '../components/StatusPickerModal';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { getDashboardSummary, type DashboardSummary } from '../api/dashboard';
import { SHOP_NAME, SHOP_CITY } from '../constants';
import { listAppointments, updateAppointmentStatus, applyPromo, type Appointment, type AppointmentStatus } from '../api/appointments';
import { listCustomers, type Customer } from '../api/customers';
import { listVehicles, updateVehicle, type Vehicle } from '../api/vehicles';
import { VALID_NEXT } from '../utils/appointmentTransitions';
import { fetchAllPages } from '../utils/fetchAllPages';

function statusLabel(s: AppointmentStatus) {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

const STATUS_COLOR: Record<AppointmentStatus, { bg: string; text: string }> = {
  pending:       { bg: 'rgba(245,158,11,0.12)', text: '#D97706' },
  confirmed:     { bg: 'rgba(59,130,246,0.12)',  text: '#2563EB' },
  'in-progress': { bg: 'rgba(139,92,246,0.12)', text: '#7C3AED' },
  completed:     { bg: 'rgba(34,197,94,0.12)',   text: '#16A34A' },
  cancelled:     { bg: 'rgba(148,163,184,0.12)', text: '#64748B' },
};

function todayLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DashboardScreen({ navigation }: any) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [todaysAppointments, setTodaysAppointments] = useState<Appointment[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
  const [vehicleMap, setVehicleMap] = useState<Record<string, Vehicle>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingAppt, setUpdatingAppt] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<Appointment | null>(null);
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [showVehicleDetail, setShowVehicleDetail] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [editPlate, setEditPlate] = useState('');
  const [editVin, setEditVin] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [dashSearch, setDashSearch] = useState('');
  const [vehicleEditError, setVehicleEditError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const today = todayLocalDate();
    try {
      const [sum, appts, customers, vehicles] = await Promise.all([
        getDashboardSummary().catch(() => null as DashboardSummary | null),
        fetchAllPages(cursor => listAppointments(cursor)).catch(() => [] as Appointment[]),
        fetchAllPages(cursor => listCustomers(cursor)).catch(() => [] as Customer[]),
        fetchAllPages(cursor => listVehicles(cursor)).catch(() => [] as Vehicle[]),
      ]);
      setSummary(sum);
      setTodaysAppointments(
        appts
          .filter(a => a.scheduledAt.startsWith(today))
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
      );
      const cmap: Record<string, Customer> = {};
      customers.forEach(c => { cmap[c.userId] = c; });
      setCustomerMap(cmap);
      const vmap: Record<string, Vehicle> = {};
      vehicles.forEach(v => { vmap[v.vehicleId] = v; });
      setVehicleMap(vmap);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function openDetail(appt: Appointment) {
    setDetailAppt(appt);
    setShowVehicleDetail(false);
    setEditingVehicle(false);
    setVehicleEditError('');
  }

  async function handleStatus(appt: Appointment, status: AppointmentStatus) {
    setUpdatingAppt(appt.appointmentId);
    try {
      await updateAppointmentStatus(appt.appointmentId, status);
      setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, status } : a));
      setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, status } : prev);
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
    Alert.alert('Apply Promo', `Mark "${appt.promoCode}" as applied for ${appt.customerName || appt.customerEmail}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Applied', onPress: async () => {
          if (!appt.promoId || !appt.customerId) return;
          setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: true } : a));
          setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, promoApplied: true } : prev);
          try {
            await applyPromo(appt.promoId, appt.customerId, appt.appointmentId);
          } catch (err: unknown) {
            setTodaysAppointments(prev => prev.map(a => a.appointmentId === appt.appointmentId ? { ...a, promoApplied: false } : a));
            setDetailAppt(prev => prev?.appointmentId === appt.appointmentId ? { ...prev, promoApplied: false } : prev);
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to apply promo.');
          }
        },
      },
    ]);
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
        {/* Shop header */}
        <View style={styles.shopHeader}>
          <Text style={styles.shopHeaderName}>{SHOP_NAME}</Text>
          {SHOP_CITY ? <Text style={styles.shopHeaderCity}>{SHOP_CITY}</Text> : null}
        </View>

        {/* KPI Grid */}
        <View style={styles.kpiGrid}>
          {kpis.map(card =>
            card.clickable ? (
              <TouchableOpacity key={card.label} style={styles.kpiCard} onPress={() => navigation?.navigate(card.screen)} activeOpacity={0.75}>
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
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            value={dashSearch}
            onChangeText={setDashSearch}
            placeholder="Search service, customer, vehicle…"
            placeholderTextColor={colors.textMuted}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>

        {(() => {
          const dashFiltered = dashSearch.trim()
            ? todaysAppointments.filter(a => {
                const q = dashSearch.toLowerCase();
                const customer = a.customerId ? customerMap[a.customerId] : undefined;
                return (
                  a.serviceName.toLowerCase().includes(q) ||
                  (a.customerName ?? '').toLowerCase().includes(q) ||
                  (a.customerEmail ?? '').toLowerCase().includes(q) ||
                  (a.vehicleSummary ?? '').toLowerCase().includes(q) ||
                  (customer?.phone ?? '').toLowerCase().includes(q)
                );
              })
            : todaysAppointments;
          return loading ? (
          <View style={styles.loadingBox}><ActivityIndicator size="small" color={colors.primary} /></View>
        ) : dashFiltered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>{dashSearch.trim() ? 'No results found' : 'No bookings today'}</Text>
          </View>
        ) : dashFiltered.map(a => {
          const sc = STATUS_COLOR[a.status];
          const isUpdating = updatingAppt === a.appointmentId;
          return (
            <TouchableOpacity key={a.appointmentId} style={styles.card} onPress={() => openDetail(a)} activeOpacity={0.85}>
              <View style={styles.cardTop}>
                <Text style={styles.serviceName} numberOfLines={1}>{a.serviceName}</Text>
                {isUpdating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : VALID_NEXT[a.status] && a.customerId ? (
                  <TouchableOpacity onPress={() => openStatusPicker(a)} style={[styles.statusBadge, { backgroundColor: sc.bg }]} activeOpacity={0.7}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{statusLabel(a.status)} ▾</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.text }]}>{statusLabel(a.status)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.customerName} numberOfLines={1}>{a.customerName || a.customerEmail}</Text>
              <View style={styles.detailRow}>
                <Ionicons name="car-outline" size={13} color={colors.textMuted} />
                <Text style={styles.detailText} numberOfLines={1}>{a.vehicleSummary}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                <Text style={styles.detailText}>{fmtDateTime(a.scheduledAt)}</Text>
              </View>
              {a.promoCode && (
                <View style={styles.detailRow}>
                  <Ionicons name="pricetag-outline" size={13} color={a.promoApplied ? colors.success : colors.secondary} />
                  <Text style={[styles.detailText, { color: a.promoApplied ? colors.success : colors.textSecondary }]}>
                    {a.promoCode}{a.promoApplied ? ' ✓ Applied' : ' — not yet applied'}
                  </Text>
                </View>
              )}
              {a.promoCode && a.customerId && !a.promoApplied && !isUpdating && (
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => confirmApplyPromo(a)} style={styles.promoBtn} activeOpacity={0.8}>
                    <Ionicons name="pricetag-outline" size={13} color={colors.secondary} />
                    <Text style={styles.promoBtnText}>Apply Promo</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        });
        })()}

        {/* Quick Navigation */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: spacing.md, marginTop: spacing.lg, marginBottom: spacing.sm }]}>Quick Navigation</Text>
        <View style={styles.quickGrid}>
          {([
            { icon: 'pricetag-outline' as const, label: 'Promotions', screen: 'Promotions' },
            { icon: 'construct-outline' as const, label: 'Services',   screen: 'Services' },
            { icon: 'settings-outline' as const, label: 'Settings',   screen: 'Settings' },
          ]).map(link => (
            <TouchableOpacity key={link.screen} style={styles.quickCard} onPress={() => navigation?.navigate(link.screen)} activeOpacity={0.75}>
              <View style={styles.quickIcon}>
                <Ionicons name={link.icon} size={26} color={colors.primary} />
              </View>
              <Text style={styles.quickLabel}>{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!detailAppt} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {detailAppt && (() => {
              const sc = STATUS_COLOR[detailAppt.status];
              const customer = detailAppt.customerId ? customerMap[detailAppt.customerId] : undefined;
              const veh = vehicleMap[detailAppt.vehicleId];
              const isUpdating = updatingAppt === detailAppt.appointmentId;
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
                        <Text style={styles.infoValue}>{detailAppt.customerEmail || '—'}</Text>
                      </View>
                      {customer?.phone ? (
                        <View style={[styles.infoRow, styles.infoRowLast]}>
                          <Ionicons name="call-outline" size={15} color={colors.textMuted} />
                          <Text style={styles.infoValue}>{customer.phone}</Text>
                        </View>
                      ) : <View style={styles.infoRowLast} />}
                    </View>

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
                        <Text style={styles.infoValue}>{fmtDateTime(detailAppt.scheduledAt)}</Text>
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
                        <Text style={styles.infoValue}>Booked {fmtDateTime(detailAppt.createdAt)}</Text>
                      </View>
                    </View>

                    <View style={styles.detailActions}>
                      {!detailAppt.customerId && (
                        <View style={styles.deletedCustomerNotice}>
                          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.deletedCustomerNoticeText}>
                            This customer's account was deleted — status is locked.
                          </Text>
                        </View>
                      )}
                      {VALID_NEXT[detailAppt.status] && detailAppt.customerId && (
                        <TouchableOpacity onPress={() => openStatusPicker(detailAppt)} style={styles.detailActionBtn} activeOpacity={0.8} disabled={isUpdating}>
                          {isUpdating
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <><Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} /><Text style={styles.detailActionText}>Change Status</Text></>
                          }
                        </TouchableOpacity>
                      )}
                      {detailAppt.promoCode && detailAppt.customerId && !detailAppt.promoApplied && !isUpdating && (
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
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  shopHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  shopHeaderName: { ...typography.h4, color: colors.textPrimary },
  shopHeaderCity: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, gap: spacing.sm },
  kpiCard: { width: '47%', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, ...shadows.sm },
  kpiIcon: { width: 44, height: 44, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  kpiValue: { ...typography.h1, color: colors.textPrimary, marginBottom: 2, fontSize: 22 },
  kpiLabel: { ...typography.small, color: colors.textSecondary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  searchInput: { flex: 1, ...typography.bodySmall, color: colors.textPrimary, paddingVertical: 8 },
  sectionTitle: { ...typography.h4, color: colors.textPrimary },
  seeAll: { ...typography.small, color: colors.primary, fontWeight: '700' },

  loadingBox: { padding: spacing.xl, alignItems: 'center' },
  emptyBox: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.lg, borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center', gap: spacing.sm, ...shadows.sm },
  emptyText: { ...typography.body, color: colors.textMuted },

  card: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  serviceName: { ...typography.h4, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  customerName: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  detailText: { ...typography.small, color: colors.textSecondary, flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  cardActions: { flexDirection: 'row', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.sm, marginTop: spacing.sm },
  promoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  promoBtnText: { fontSize: 12, color: colors.secondary, fontWeight: '600' },

  quickGrid: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.lg },
  quickCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  quickIcon: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  quickLabel: { ...typography.small, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },

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
  deletedCustomerNotice: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: borderRadius.md, paddingVertical: 12, paddingHorizontal: spacing.sm, backgroundColor: colors.background },
  deletedCustomerNoticeText: { ...typography.small, color: colors.textMuted, flex: 1 },
});
