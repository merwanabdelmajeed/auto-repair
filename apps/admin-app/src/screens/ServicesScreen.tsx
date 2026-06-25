import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

const SERVICE_EXAMPLES = [
  { icon: 'water-outline', name: 'Oil Change', category: 'Maintenance', est: '30 min' },
  { icon: 'disc-outline', name: 'Brake Service', category: 'Safety', est: '90 min' },
  { icon: 'search-outline', name: 'Diagnostics', category: 'Inspection', est: '60 min' },
  { icon: 'sync-outline', name: 'Tire Rotation', category: 'Maintenance', est: '30 min' },
  { icon: 'settings-outline', name: 'Transmission Service', category: 'Major Service', est: '120 min' },
  { icon: 'move-outline', name: 'Alignment', category: 'Maintenance', est: '45 min' },
];

export default function ServicesScreen() {
  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.xs }} />
            <Text style={styles.searchPlaceholder}>Search services…</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.85}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color={colors.info} />
          <Text style={styles.infoText}>
            These are placeholder examples. Real services will be created and managed per location in Phase 5.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Service Catalog (Example)</Text>

        {SERVICE_EXAMPLES.map((service) => (
          <View key={service.name} style={styles.serviceCard}>
            <View style={styles.serviceIcon}>
              <Ionicons name={service.icon as any} size={22} color={colors.secondary} />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.serviceMeta}>{service.category} · Est. {service.est}</Text>
            </View>
            <View style={styles.serviceActions}>
              <View style={styles.activeBadge}>
                <Text style={styles.activeText}>Active</Text>
              </View>
              <TouchableOpacity style={styles.editBtn}>
                <Ionicons name="ellipsis-vertical" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.capabilityCard}>
          <Text style={styles.capabilityTitle}>Service Management Features</Text>
          {['Create & categorize services', 'Set duration & price per location', 'Enable/disable per location', 'Drag to reorder in customer app'].map((cap) => (
            <View key={cap} style={styles.capRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginRight: spacing.sm }} />
              <Text style={styles.capText}>{cap}</Text>
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

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  searchPlaceholder: { ...typography.body, color: colors.textMuted },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },

  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  infoText: { ...typography.small, color: colors.textSecondary, flex: 1, lineHeight: 18 },

  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(245,158,11,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  serviceInfo: { flex: 1 },
  serviceName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  serviceMeta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  serviceActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  activeBadge: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  activeText: { ...typography.small, color: colors.success, fontWeight: '600' },
  editBtn: { padding: spacing.xs },

  capabilityCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  capabilityTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: spacing.md },
  capRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  capText: { ...typography.bodySmall, color: colors.textSecondary },
});
