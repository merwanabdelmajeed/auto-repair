import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  ActivityIndicator, Alert, RefreshControl, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listVehicles, type Vehicle } from '../api/vehicles';
import { listCustomers, type Customer } from '../api/customers';

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

  const customerIdFilter: string | undefined = route?.params?.customerId;

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [v, c] = await Promise.all([listVehicles(), listCustomers()]);
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

  useEffect(() => { void load(); }, [load]);

  const filtered = vehicles
    .filter(v => !customerIdFilter || v.customerId === customerIdFilter)
    .filter(v => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        `${v.year} ${v.make} ${v.model}`.toLowerCase().includes(q) ||
        v.licensePlate.toLowerCase().includes(q) ||
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
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={colors.secondary} />}
        >
          {filterCustomer ? (
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
          )}

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="car-outline" size={48} color={colors.textMuted} /></View>
              <Text style={styles.emptyTitle}>{search ? 'No matches found' : 'No Vehicles'}</Text>
              <Text style={styles.emptyDesc}>
                {search ? 'Try a different search term.' : filterCustomer ? 'This customer has no registered vehicles.' : 'Vehicles appear here when customers add them through the customer app.'}
              </Text>
            </View>
          ) : filtered.map(v => {
            const owner = customerMap[v.customerId];
            return (
              <View key={v.vehicleId} style={styles.card}>
                <View style={styles.cardIcon}>
                  <Ionicons name="car" size={26} color={colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{v.year} {v.make} {v.model}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.plateBadge}><Text style={styles.plateText}>{v.licensePlate}</Text></View>
                    <Text style={styles.metaText}>{v.color}</Text>
                  </View>
                  {v.vin ? <Text style={styles.vin}>VIN: {v.vin}</Text> : null}
                  {owner && (
                    <TouchableOpacity
                      style={styles.ownerLink}
                      onPress={() => navigation.navigate('Customers', { customerId: v.customerId })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="person-outline" size={12} color={colors.primary} />
                      <Text style={styles.ownerText}>{displayName(owner)}</Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
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

  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  cardIcon: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  cardInfo: { flex: 1 },
  cardTitle: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  plateBadge: { backgroundColor: colors.primary, borderRadius: borderRadius.xs, paddingHorizontal: 8, paddingVertical: 2 },
  plateText: { ...typography.small, color: colors.white, fontWeight: '700', letterSpacing: 1 },
  metaText: { ...typography.small, color: colors.textSecondary },
  vin: { ...typography.small, color: colors.textMuted, marginBottom: 4 },

  ownerLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(15,32,68,0.06)', borderRadius: borderRadius.xs, paddingHorizontal: 8, paddingVertical: 3 },
  ownerText: { ...typography.small, color: colors.primary, fontWeight: '600' },
});
