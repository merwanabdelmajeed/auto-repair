import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  ActivityIndicator, Alert, RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listCustomers, type Customer } from '../api/customers';
import { listVehicles, type Vehicle } from '../api/vehicles';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase();
  return c.email[0].toUpperCase();
}

function displayName(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName} ${c.lastName}`.trim();
  return c.email;
}

export default function CustomersScreen({ navigation, route }: any) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicleMap, setVehicleMap] = useState<Record<string, Vehicle[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const customerIdFilter: string | undefined = route?.params?.customerId;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [c, v] = await Promise.all([listCustomers(), listVehicles()]);
      setCustomers(c);
      const map: Record<string, Vehicle[]> = {};
      v.forEach(veh => {
        if (!map[veh.customerId]) map[veh.customerId] = [];
        map[veh.customerId].push(veh);
      });
      setVehicleMap(map);
    } catch {
      Alert.alert('Error', 'Failed to load customers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const base = customerIdFilter
    ? customers.filter(c => c.userId === customerIdFilter)
    : customers;

  const filtered = search.trim()
    ? base.filter(c =>
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : base;

  return (
    <Layout>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email, or phone…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Ionicons name="close-circle" size={18} color={colors.textMuted} onPress={() => setSearch('')} />
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.secondary} />}
        >
          {customerIdFilter ? (
            <TouchableOpacity style={styles.filterBanner} onPress={() => navigation.navigate('Customers', { customerId: undefined })}>
              <Ionicons name="arrow-back" size={16} color={colors.primary} />
              <Text style={styles.filterClear}>Back to all customers</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.statsRow}>
              {[
                { label: 'Total', value: customers.length },
                { label: 'Showing', value: filtered.length },
              ].map(s => (
                <View key={s.label} style={styles.statCard}>
                  <Text style={styles.statValue}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="people-outline" size={48} color={colors.textMuted} /></View>
              <Text style={styles.emptyTitle}>{search ? 'No matches found' : 'No Customers Yet'}</Text>
              <Text style={styles.emptyDesc}>
                {search ? 'Try a different search term.' : 'Customers appear here when they register through the customer app.'}
              </Text>
            </View>
          ) : filtered.map(c => (
            <TouchableOpacity key={c.userId} style={styles.card} onPress={() => setSelectedCustomer(c)} activeOpacity={0.85}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(c)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{displayName(c)}</Text>
                {(c.firstName || c.lastName) && <Text style={styles.cardEmail}>{c.email}</Text>}
                <Text style={[styles.cardPhone, !c.phone && styles.cardPhoneMuted]}>
                  {c.phone ?? '—'}
                </Text>
                <Text style={styles.cardDate}>Joined {fmtDate(c.createdAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Customer Detail Modal */}
      <Modal visible={!!selectedCustomer} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedCustomer && (() => {
              const vehicles = vehicleMap[selectedCustomer.userId] ?? [];
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Customer Details</Text>
                    <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
                    {/* Profile header */}
                    <View style={styles.profileHeader}>
                      <View style={styles.profileAvatar}>
                        <Text style={styles.profileAvatarText}>{initials(selectedCustomer)}</Text>
                      </View>
                      <Text style={styles.profileName}>{displayName(selectedCustomer)}</Text>
                      <View style={[styles.statusChip, selectedCustomer.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive]}>
                        <Text style={[styles.statusChipText, { color: selectedCustomer.status === 'ACTIVE' ? colors.success : colors.textMuted }]}>
                          {selectedCustomer.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>

                    {/* Contact info */}
                    <Text style={styles.sectionLabel}>Contact</Text>
                    <View style={styles.infoCard}>
                      <View style={styles.infoRow}>
                        <Ionicons name="mail-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.infoValue}>{selectedCustomer.email}</Text>
                      </View>
                      <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Ionicons name="call-outline" size={15} color={colors.textMuted} />
                        <Text style={[styles.infoValue, !selectedCustomer.phone && { color: colors.textMuted }]}>
                          {selectedCustomer.phone ?? 'No phone number'}
                        </Text>
                      </View>
                    </View>

                    {/* Account */}
                    <Text style={styles.sectionLabel}>Account</Text>
                    <View style={styles.infoCard}>
                      <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.infoValue}>Joined {fmtDate(selectedCustomer.createdAt)}</Text>
                      </View>
                    </View>

                    {/* Vehicles */}
                    <Text style={styles.sectionLabel}>
                      Vehicles ({vehicles.length})
                    </Text>
                    {vehicles.length === 0 ? (
                      <View style={styles.noVehicles}>
                        <Ionicons name="car-outline" size={22} color={colors.textMuted} />
                        <Text style={styles.noVehiclesText}>No vehicles registered</Text>
                      </View>
                    ) : (
                      <View style={styles.infoCard}>
                        {vehicles.map((v, i) => (
                          <TouchableOpacity
                            key={v.vehicleId}
                            style={[styles.vehicleRow, i === vehicles.length - 1 && styles.infoRowLast]}
                            onPress={() => {
                              setSelectedCustomer(null);
                              navigation.navigate('Vehicles', { customerId: selectedCustomer.userId });
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={styles.vehicleRowLeft}>
                              <Ionicons name="car-outline" size={15} color={colors.primary} />
                              <View>
                                <Text style={styles.vehicleRowName}>
                                  {v.year} {v.make} {v.model}
                                </Text>
                                {v.licensePlate ? <Text style={styles.vehicleRowPlate}>{v.licensePlate}</Text> : null}
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
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
  content: { paddingBottom: spacing.xxl },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, margin: spacing.md, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: 11, ...shadows.sm },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary },

  filterBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: 'rgba(15,32,68,0.06)', borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  filterClear: { ...typography.small, color: colors.primary, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  statValue: { ...typography.h2, color: colors.textPrimary, fontSize: 24 },
  statLabel: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { ...typography.h4, color: colors.white, fontSize: 16 },
  cardInfo: { flex: 1 },
  cardName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  cardEmail: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
  cardPhone: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
  cardPhoneMuted: { color: colors.textMuted },
  cardDate: { ...typography.small, color: colors.textMuted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.textPrimary },

  profileHeader: { alignItems: 'center', marginBottom: spacing.lg },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  profileAvatarText: { ...typography.h2, color: colors.white, fontSize: 22 },
  profileName: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  statusChip: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 3 },
  statusActive: { backgroundColor: 'rgba(34,197,94,0.12)' },
  statusInactive: { backgroundColor: 'rgba(148,163,184,0.12)' },
  statusChipText: { fontSize: 12, fontWeight: '700' },

  sectionLabel: { ...typography.label, color: colors.textMuted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: spacing.md },
  infoCard: { backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoRowLast: { borderBottomWidth: 0 },
  infoValue: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },

  noVehicles: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  noVehiclesText: { ...typography.bodySmall, color: colors.textMuted },

  vehicleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  vehicleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  vehicleRowName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  vehicleRowPlate: { ...typography.small, color: colors.textSecondary },
});
