import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export default function PromotionsScreen() {
  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
            <Text style={styles.searchPlaceholder}>Search promotions…</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {['All', 'Active', 'Scheduled', 'Expired'].map((f, i) => (
            <TouchableOpacity key={f} style={[styles.filterChip, i === 0 && styles.filterChipActive]}>
              <Text style={[styles.filterText, i === 0 && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={52} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Promotions Created</Text>
          <Text style={styles.emptyDesc}>
            Create promotions that appear on the customer app home screen. Promotions can be tenant-wide or location-specific.
          </Text>
          <TouchableOpacity style={styles.createBtn} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={18} color={colors.white} />
            <Text style={styles.createBtnText}>Create First Promotion</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldsCard}>
          <Text style={styles.fieldsTitle}>Promotion Fields</Text>
          {[
            { icon: 'text-outline', label: 'Title & Description' },
            { icon: 'image-outline', label: 'Promotional Image (S3)' },
            { icon: 'calendar-outline', label: 'Start & End Date' },
            { icon: 'flag-outline', label: 'Priority (display order)' },
            { icon: 'location-outline', label: 'Scope: Tenant-wide or Location-specific' },
            { icon: 'toggle-outline', label: 'Active/Inactive toggle' },
          ].map((field) => (
            <View key={field.label} style={styles.fieldRow}>
              <Ionicons name={field.icon as any} size={16} color={colors.primary} style={{ marginRight: spacing.sm }} />
              <Text style={styles.fieldText}>{field.label}</Text>
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
  topBar: { flexDirection: 'row', alignItems: 'center', margin: spacing.md, gap: spacing.sm },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  searchPlaceholder: { ...typography.body, color: colors.textMuted },
  addBtn: { width: 46, height: 46, borderRadius: borderRadius.lg, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', ...shadows.sm },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: borderRadius.round, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: colors.white },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: 13, paddingHorizontal: spacing.xl, gap: spacing.sm },
  createBtnText: { ...typography.h4, color: colors.white },
  fieldsCard: { backgroundColor: colors.surface, marginHorizontal: spacing.md, borderRadius: borderRadius.xl, padding: spacing.md, ...shadows.sm },
  fieldsTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
  fieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  fieldText: { ...typography.bodySmall, color: colors.textSecondary },
});
