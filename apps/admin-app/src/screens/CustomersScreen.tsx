import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  ActivityIndicator, Alert, RefreshControl, TouchableOpacity,
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

  useEffect(() => { void load(); }, [load]);

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

  const active = customers.filter(c => c.status === 'ACTIVE').length;

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
                { label: 'Active', value: active },
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
          ) : filtered.map(c => {
            const vehicles = vehicleMap[c.userId] ?? [];
            return (
              <View key={c.userId} style={styles.card}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(c)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{displayName(c)}</Text>
                  {(c.firstName || c.lastName) && <Text style={styles.cardEmail}>{c.email}</Text>}
                  {c.phone && <Text style={styles.cardPhone}>{c.phone}</Text>}
                  <Text style={styles.cardDate}>Joined {fmtDate(c.createdAt)}</Text>
                  {vehicles.length > 0 && (
                    <TouchableOpacity
                      style={styles.vehicleLink}
                      onPress={() => navigation.navigate('Vehicles', { customerId: c.userId })}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="car-outline" size={12} color={colors.primary} />
                      <Text style={styles.vehicleLinkText}>
                        {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
                      </Text>
                      <Ionicons name="chevron-forward" size={12} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={[styles.statusDot, c.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive]} />
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
  filterClear: { ...typography.small, color: colors.primary, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  statValue: { ...typography.h2, color: colors.textPrimary, fontSize: 24 },
  statLabel: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md, marginTop: 2 },
  avatarText: { ...typography.h4, color: colors.white, fontSize: 16 },
  cardInfo: { flex: 1 },
  cardName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700', marginBottom: 2 },
  cardEmail: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
  cardPhone: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
  cardDate:  { ...typography.small, color: colors.textMuted, marginBottom: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginLeft: spacing.sm, marginTop: 4 },
  statusActive: { backgroundColor: colors.success },
  statusInactive: { backgroundColor: colors.textMuted },

  vehicleLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(15,32,68,0.06)', borderRadius: borderRadius.xs, paddingHorizontal: 8, paddingVertical: 3 },
  vehicleLinkText: { ...typography.small, color: colors.primary, fontWeight: '600' },
});
