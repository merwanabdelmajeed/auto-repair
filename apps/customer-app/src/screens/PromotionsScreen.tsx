import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

const PROMOTIONS = [
  {
    id: '1',
    title: 'Summer Oil Change Special',
    description: 'Full synthetic oil change + tire rotation included. Save $20 on your next service visit.',
    badge: 'LIMITED TIME',
    badgeColor: '#EF4444',
    icon: 'water-outline' as const,
    expires: 'Expires Jul 31, 2026',
  },
  {
    id: '2',
    title: 'Free Brake Inspection',
    description: 'Complimentary 21-point brake inspection with any service this month. No purchase necessary.',
    badge: 'NEW',
    badgeColor: '#22C55E',
    icon: 'shield-checkmark-outline' as const,
    expires: 'Expires Jun 30, 2026',
  },
  {
    id: '3',
    title: '15% Off AC Service',
    description: 'Full AC system inspection, recharge, and leak check. Beat the summer heat!',
    badge: 'SEASONAL',
    badgeColor: '#3B82F6',
    icon: 'thermometer-outline' as const,
    expires: 'Expires Aug 15, 2026',
  },
  {
    id: '4',
    title: 'Senior Discount — 10% Off',
    description: 'We appreciate our senior customers. 10% off all labor on Tuesdays and Wednesdays.',
    badge: 'ONGOING',
    badgeColor: '#8B5CF6',
    icon: 'heart-outline' as const,
    expires: 'No expiry',
  },
];

export default function PromotionsScreen() {
  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Current Offers</Text>
          <Text style={styles.pageSubtitle}>
            Exclusive deals for our valued customers
          </Text>
        </View>

        {PROMOTIONS.map((promo) => (
          <View key={promo.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>
                <Ionicons name={promo.icon} size={28} color={colors.secondary} />
              </View>
              <View
                style={[styles.badge, { backgroundColor: promo.badgeColor + '20', borderColor: promo.badgeColor + '40' }]}
              >
                <Text style={[styles.badgeText, { color: promo.badgeColor }]}>
                  {promo.badge}
                </Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{promo.title}</Text>
            <Text style={styles.cardDesc}>{promo.description}</Text>
            <View style={styles.cardFooter}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.expiresText}>{promo.expires}</Text>
            </View>
          </View>
        ))}

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.noticeText}>
            Promotions are managed by your selected shop location. Offers may vary by location.
          </Text>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  pageHeader: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  pageTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  pageSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(245,158,11,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.small,
    fontWeight: '700',
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  cardDesc: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: spacing.sm,
  },
  expiresText: {
    ...typography.small,
    color: colors.textMuted,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  noticeText: {
    ...typography.small,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
