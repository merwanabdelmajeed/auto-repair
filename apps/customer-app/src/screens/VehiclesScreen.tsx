import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export default function VehiclesScreen() {
  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Empty State */}
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="car-outline" size={52} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Vehicles Added</Text>
          <Text style={styles.emptyDesc}>
            Add your vehicles to quickly book appointments and track service history.
          </Text>
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color={colors.white} />
            <Text style={styles.addBtnText}>Add Vehicle</Text>
          </TouchableOpacity>
        </View>

        {/* What You Can Add */}
        <Text style={styles.sectionTitle}>Vehicle Information We Track</Text>
        <View style={styles.fieldsCard}>
          {[
            { icon: 'car-sport-outline', label: 'Make & Model', desc: 'e.g. Toyota Camry' },
            { icon: 'calendar-number-outline', label: 'Year', desc: 'e.g. 2021' },
            { icon: 'barcode-outline', label: 'VIN (Optional)', desc: '17-character identifier' },
            { icon: 'speedometer-outline', label: 'Current Mileage', desc: 'Updated at each visit' },
          ].map((field) => (
            <View key={field.label} style={styles.fieldRow}>
              <View style={styles.fieldIcon}>
                <Ionicons name={field.icon as any} size={20} color={colors.primary} />
              </View>
              <View style={styles.fieldText}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldDesc}>{field.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.nhtsaNote}>
          <Ionicons name="globe-outline" size={16} color={colors.primary} style={{ marginRight: spacing.sm }} />
          <Text style={styles.nhtsaText}>
            Vehicle makes, models, and years are loaded from the official NHTSA database — no guessing required.
          </Text>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },

  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  addBtnText: {
    ...typography.h4,
    color: colors.white,
  },

  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },

  fieldsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    ...shadows.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  fieldText: { flex: 1 },
  fieldLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  fieldDesc: {
    ...typography.small,
    color: colors.textSecondary,
  },

  nhtsaNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(15,32,68,0.05)',
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  nhtsaText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },

  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
});
