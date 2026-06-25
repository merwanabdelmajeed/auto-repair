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

export default function AppointmentsScreen({ navigation }: any) {
  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Tabs */}
        <View style={styles.tabs}>
          <View style={[styles.tab, styles.tabActive]}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Upcoming</Text>
          </View>
          <View style={styles.tab}>
            <Text style={styles.tabText}>Past</Text>
          </View>
        </View>

        {/* Empty State */}
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="calendar-outline" size={52} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Upcoming Appointments</Text>
          <Text style={styles.emptyDesc}>
            Schedule your next service visit and we'll keep your vehicle in top shape.
          </Text>
          <TouchableOpacity style={styles.bookBtn} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={20} color={colors.white} />
            <Text style={styles.bookBtnText}>Book an Appointment</Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.info} style={styles.infoIcon} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How Booking Works</Text>
            <Text style={styles.infoText}>Select your vehicle, choose a service, pick an available date and time, and we'll confirm your booking.</Text>
          </View>
        </View>

        <View style={styles.stepsCard}>
          {[
            { step: '1', icon: 'car-outline', label: 'Select Vehicle' },
            { step: '2', icon: 'construct-outline', label: 'Choose Service' },
            { step: '3', icon: 'calendar-outline', label: 'Pick Date & Time' },
            { step: '4', icon: 'checkmark-circle-outline', label: 'Confirm Booking' },
          ].map((s) => (
            <View key={s.step} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{s.step}</Text>
              </View>
              <Ionicons name={s.icon as any} size={20} color={colors.primary} style={styles.stepIcon} />
              <Text style={styles.stepLabel}>{s.label}</Text>
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

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: 4,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.white,
  },

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
    lineHeight: 22,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  bookBtnText: {
    ...typography.h4,
    color: colors.white,
  },

  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  infoIcon: { marginRight: spacing.sm, marginTop: 2 },
  infoContent: { flex: 1 },
  infoTitle: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  stepsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepNumText: {
    ...typography.small,
    color: colors.white,
    fontWeight: '700',
  },
  stepIcon: { marginRight: spacing.sm },
  stepLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});
