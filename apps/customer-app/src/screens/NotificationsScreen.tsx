import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export default function NotificationsScreen() {
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
            <Ionicons name="notifications-outline" size={52} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Notifications Yet</Text>
          <Text style={styles.emptyDesc}>
            We'll notify you about appointment reminders, confirmations, promotions, and shop announcements.
          </Text>
        </View>

        {/* What to Expect */}
        <Text style={styles.sectionTitle}>You'll Receive Notifications For</Text>
        <View style={styles.card}>
          {[
            {
              icon: 'calendar-outline' as const,
              title: 'Appointment Confirmation',
              desc: 'When your booking is confirmed by the shop',
            },
            {
              icon: 'alarm-outline' as const,
              title: 'Appointment Reminders',
              desc: '24 hours and 1 hour before your appointment',
            },
            {
              icon: 'checkmark-done-outline' as const,
              title: 'Service Complete',
              desc: 'When your vehicle is ready for pickup',
            },
            {
              icon: 'pricetag-outline' as const,
              title: 'New Promotions',
              desc: 'Special offers from your preferred location',
            },
            {
              icon: 'megaphone-outline' as const,
              title: 'Shop Announcements',
              desc: 'Hours changes, holiday closures, and updates',
            },
          ].map((item, i, arr) => (
            <View
              key={item.title}
              style={[styles.notifRow, i === arr.length - 1 && styles.notifRowLast]}
            >
              <View style={styles.notifIcon}>
                <Ionicons name={item.icon} size={20} color={colors.secondary} />
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifTitle}>{item.title}</Text>
                <Text style={styles.notifDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.permissionNote}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
          <Text style={styles.permissionText}>
            Notification permissions are managed in Settings. You can opt out at any time.
          </Text>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

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
    lineHeight: 22,
  },

  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    ...shadows.sm,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  notifRowLast: {
    borderBottomWidth: 0,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(245,158,11,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  notifContent: { flex: 1 },
  notifTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 3,
  },
  notifDesc: {
    ...typography.small,
    color: colors.textSecondary,
  },

  permissionNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    borderRadius: borderRadius.lg,
  },
  permissionText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
