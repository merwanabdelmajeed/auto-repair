import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, FlatList, ScrollView, StyleSheet, TextInput,
  ActivityIndicator, Alert, RefreshControl, TouchableOpacity, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listVehicles, updateVehicle, type Vehicle } from '../api/vehicles';
import { listCustomers, type Customer } from '../api/customers';
import { fetchAllPages } from '../utils/fetchAllPages';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function displayName(c: Customer) {
  if (c.firstName || c.lastName) return `${c.firstName} ${c.lastName}`.trim();
  return c.email;
}

export default function VehiclesScreen({ navigation, route }: any) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customerMap, setCustomerMap] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editPlate, setEditPlate] = useState('');
  const [editVin, setEditVin] = useState('');
  const [saving, setSaving] = useState(false);

  const customerIdFilter: string | undefined = route?.params?.customerId;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [v, c] = await Promise.all([
        fetchAllPages(cursor => listVehicles(cursor)),
        fetchAllPages(cursor => listCustomers(cursor)),
      ]);
      setVehicles(v);
      const map: Record<string, Customer> = {};
      c.forEach(cu => { map[cu.userId] = cu; });
      setCustomerMap(map);
    } catch {
      Alert.alert('Error', 'Failed to load vehicles.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function openDetail(v: Vehicle) {
    setSelectedVehicle(v);
    setIsEditing(false);
  }

  function startEdit() {
    if (!selectedVehicle) return;
    setEditPlate(selectedVehicle.licensePlate ?? '');
    setEditVin(selectedVehicle.vin ?? '');
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  async function saveEdit() {
    if (!selectedVehicle) return;
    setSaving(true);
    try {
      const updated = await updateVehicle(selectedVehicle.vehicleId, {
        licensePlate: editPlate.trim() || undefined,
        vin: editVin.trim() || undefined,
      });
      const merged = { ...selectedVehicle, ...updated };
      setVehicles(prev => prev.map(v => v.vehicleId === selectedVehicle.vehicleId ? merged : v));
      setSelectedVehicle(merged);
      setIsEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  const filtered = vehicles
    .filter(v => !customerIdFilter || v.customerId === customerIdFilter)
    .filter(v => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q) ||
        (v.licensePlate ?? '').toLowerCase().includes(q) ||
        (v.vin ?? '').toLowerCase().includes(q)
      );
    });

  const filterCustomer = customerIdFilter ? customerMap[customerIdFilter] : null;

  return (
    <Layout>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by make, model, plate, VIN…"
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
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.secondary} />}
          data={filtered}
          keyExtractor={v => v.vehicleId}
          ListHeaderComponent={
            filterCustomer ? (
              <View style={styles.filterBanner}>
                <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.filterText}>
                  Vehicles for <Text style={styles.filterName}>{displayName(filterCustomer)}</Text>
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Vehicles', { customerId: undefined })}>
                  <Text style={styles.filterClear}>Show all</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.count}>{filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}</Text>
            )
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="car-outline" size={48} color={colors.textMuted} /></View>
              <Text style={styles.emptyTitle}>{search ? 'No matches found' : 'No Vehicles'}</Text>
              <Text style={styles.emptyDesc}>
                {search ? 'Try a different search term.' : filterCustomer ? 'This customer has no registered vehicles.' : 'Vehicles appear here when customers add them through the customer app.'}
              </Text>
            </View>
          }
          renderItem={({ item: v }) => {
            const owner = customerMap[v.customerId];
            return (
              <TouchableOpacity style={styles.card} onPress={() => openDetail(v)} activeOpacity={0.85}>
                <View style={styles.cardIcon}>
                  <Ionicons name="car" size={26} color={colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>
                    {v.year} {v.make} {v.model}{v.trim ? ' ' + v.trim : ''}
                  </Text>
                  <View style={styles.metaRow}>
                    {v.licensePlate
                      ? <View style={styles.plateBadge}><Text style={styles.plateText}>{v.licensePlate}</Text></View>
                      : <Text style={styles.metaMuted}>No plate</Text>}
                    <Text style={styles.metaText}>{v.color}</Text>
                  </View>
                  {owner && (
                    <Text style={styles.ownerText}>
                      <Ionicons name="person-outline" size={11} color={colors.textMuted} /> {displayName(owner)}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Vehicle Detail Modal */}
      <Modal visible={!!selectedVehicle} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedVehicle && (() => {
              const owner = customerMap[selectedVehicle.customerId];
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Vehicle Details</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {isEditing ? null : (
                        <TouchableOpacity onPress={startEdit} style={styles.editHeaderBtn}>
                          <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                          <Text style={styles.editHeaderBtnText}>Edit</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => { setSelectedVehicle(null); setIsEditing(false); }}>
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
                    {/* Vehicle header */}
                    <View style={styles.vehicleHeader}>
                      <View style={styles.vehicleHeaderIcon}>
                        <Ionicons name="car" size={34} color={colors.primary} />
                      </View>
                      <Text style={styles.vehicleHeaderTitle}>
                        {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                        {selectedVehicle.trim ? ' ' + selectedVehicle.trim : ''}
                      </Text>
                    </View>

                    {/* Vehicle info */}
                    <Text style={styles.sectionLabel}>Details</Text>
                    <View style={styles.infoCard}>
                      {/* License Plate - read or edit */}
                      {isEditing ? (
                        <View style={styles.editRow}>
                          <Ionicons name="card-outline" size={15} color={colors.textMuted} />
                          <TextInput
                            style={styles.editInput}
                            value={editPlate}
                            onChangeText={setEditPlate}
                            placeholder="License plate"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="characters"
                          />
                        </View>
                      ) : (
                        <View style={styles.infoRow}>
                          <Ionicons name="card-outline" size={15} color={colors.textMuted} />
                          <Text style={[styles.infoValue, !selectedVehicle.licensePlate && { color: colors.textMuted }]}>
                            {selectedVehicle.licensePlate || 'No license plate'}
                          </Text>
                        </View>
                      )}

                      <View style={styles.infoRow}>
                        <Ionicons name="color-palette-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.infoValue}>{selectedVehicle.color}</Text>
                      </View>

                      {/* VIN - read or edit */}
                      {isEditing ? (
                        <View style={styles.editRow}>
                          <Ionicons name="barcode-outline" size={15} color={colors.textMuted} />
                          <TextInput
                            style={styles.editInput}
                            value={editVin}
                            onChangeText={setEditVin}
                            placeholder="VIN number"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="characters"
                          />
                        </View>
                      ) : (
                        <View style={styles.infoRow}>
                          <Ionicons name="barcode-outline" size={15} color={colors.textMuted} />
                          <Text style={[styles.infoValue, !selectedVehicle.vin && { color: colors.textMuted }]}>
                            {selectedVehicle.vin ? `VIN: ${selectedVehicle.vin}` : 'No VIN on file'}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.infoValue}>Added {fmtDate(selectedVehicle.createdAt)}</Text>
                      </View>
                    </View>

                    {/* Edit actions */}
                    {isEditing && (
                      <View style={styles.editActions}>
                        <TouchableOpacity onPress={cancelEdit} style={styles.cancelBtn} activeOpacity={0.8}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => void saveEdit()} style={styles.saveBtn} activeOpacity={0.8} disabled={saving}>
                          {saving
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <Text style={styles.saveBtnText}>Save Changes</Text>}
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Owner info */}
                    {owner && !isEditing && (
                      <>
                        <Text style={styles.sectionLabel}>Owner</Text>
                        <TouchableOpacity
                          style={styles.ownerCard}
                          onPress={() => {
                            setSelectedVehicle(null);
                            navigation.navigate('Customers', { customerId: selectedVehicle.customerId });
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={styles.ownerAvatar}>
                            <Text style={styles.ownerAvatarText}>
                              {(owner.firstName?.[0] ?? owner.email[0]).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ownerName}>{displayName(owner)}</Text>
                            <Text style={styles.ownerEmail}>{owner.email}</Text>
                            {owner.phone ? <Text style={styles.ownerPhone}>{owner.phone}</Text> : null}
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      </>
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
  filterText: { flex: 1, ...typography.small, color: colors.textSecondary },
  filterName: { fontWeight: '700', color: colors.textPrimary },
  filterClear: { ...typography.small, color: colors.primary, fontWeight: '700' },

  count: { ...typography.small, color: colors.textMuted, paddingHorizontal: spacing.md, marginBottom: spacing.sm },

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  cardIcon: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  cardInfo: { flex: 1 },
  cardTitle: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  plateBadge: { backgroundColor: colors.primary, borderRadius: borderRadius.xs, paddingHorizontal: 8, paddingVertical: 2 },
  plateText: { ...typography.small, color: colors.white, fontWeight: '700', letterSpacing: 1 },
  metaText: { ...typography.small, color: colors.textSecondary },
  metaMuted: { ...typography.small, color: colors.textMuted },
  ownerText: { ...typography.small, color: colors.textMuted, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  editHeaderBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.background },
  editHeaderBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

  vehicleHeader: { alignItems: 'center', marginBottom: spacing.lg },
  vehicleHeaderIcon: { width: 72, height: 72, borderRadius: borderRadius.xl, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  vehicleHeaderTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },

  sectionLabel: { ...typography.label, color: colors.textMuted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: spacing.md },
  infoCard: { backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoRowLast: { borderBottomWidth: 0 },
  infoValue: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },

  editRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  editInput: { flex: 1, ...typography.bodySmall, color: colors.textPrimary, borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 7, backgroundColor: colors.surface },

  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingVertical: 11, alignItems: 'center', backgroundColor: colors.background },
  cancelBtnText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: colors.secondary, borderRadius: borderRadius.md, paddingVertical: 11, alignItems: 'center' },
  saveBtnText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },

  ownerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  ownerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  ownerAvatarText: { ...typography.h4, color: colors.white, fontSize: 15 },
  ownerName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  ownerEmail: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
  ownerPhone: { ...typography.small, color: colors.textSecondary },
});
