import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export default function VehiclesScreen() {
  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
          <Text style={styles.searchPlaceholder}>Search by make, model, VIN…</Text>
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="car-outline" size={52} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Vehicles Registered</Text>
          <Text style={styles.emptyDesc}>
            Vehicles appear here when customers add them through the customer app. All data pulls from the NHTSA database.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>NHTSA Data Integration</Text>
        <View style={styles.nhtsaCard}>
          {[
            { icon: 'globe-outline', text: 'Makes loaded from NHTSA API — no hardcoded data' },
            { icon: 'list-outline', text: 'Models populated dynamically based on selected make' },
            { icon: 'calendar-number-outline', text: 'Model years fetched in real-time from NHTSA' },
            { icon: 'refresh-outline', text: 'Cached responses reduce API calls and improve speed' },
          ].map((item) => (
            <View key={item.text} style={styles.nhtsaRow}>
              <Ionicons name={item.icon as any} size={18} color={colors.secondary} style={{ marginRight: spacing.sm }} />
              <Text style={styles.nhtsaText}>{item.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  searchPlaceholder: { ...typography.body, color: colors.textMuted, flex: 1 },

  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  nhtsaCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  nhtsaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  nhtsaText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 20 },
});
