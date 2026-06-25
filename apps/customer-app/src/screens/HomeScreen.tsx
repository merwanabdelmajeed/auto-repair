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

const PLACEHOLDER_PROMOTIONS = [
  {
    id: '1',
    title: 'Summer Oil Change Special',
    description: 'Full synthetic oil change + tire rotation for just $59.99',
    badge: 'LIMITED TIME',
    icon: 'water-outline' as const,
  },
  {
    id: '2',
    title: 'Brake Inspection — FREE',
    description: 'Complimentary brake inspection with any service this month',
    badge: 'NEW',
    icon: 'shield-checkmark-outline' as const,
  },
  {
    id: '3',
    title: '15% Off AC Service',
    description: 'Beat the heat — get your AC system checked and recharged',
    badge: 'SEASONAL',
    icon: 'thermometer-outline' as const,
  },
];

const QUICK_ACTIONS = [
  { icon: 'calendar-outline' as const, label: 'Book\nAppointment', screen: 'Appointments' },
  { icon: 'car-outline' as const, label: 'My\nVehicles', screen: 'Vehicles' },
  { icon: 'pricetag-outline' as const, label: 'Promotions', screen: 'Promotions' },
  { icon: 'notifications-outline' as const, label: 'Notifications', screen: 'Notifications' },
];

export default function HomeScreen({ navigation }: any) {
  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerInner}>
            <View style={styles.bannerIcon}>
              <Ionicons name="construct" size={28} color={colors.secondary} />
            </View>
            <View style={styles.bannerText}>
              <Text style={styles.bannerGreeting}>Welcome back!</Text>
              <Text style={styles.bannerTitle}>AutoRepair Pro</Text>
              <Text style={styles.bannerSub}>
                Your trusted auto service partner
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => navigation.navigate('Appointments')}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar" size={18} color={colors.primary} />
            <Text style={styles.bookBtnText}>Book Appointment</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.screen}
              style={styles.quickAction}
              onPress={() => navigation.navigate(action.screen)}
              activeOpacity={0.75}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name={action.icon} size={24} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active Promotions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Promotions</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Promotions')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {PLACEHOLDER_PROMOTIONS.map((promo) => (
          <View key={promo.id} style={styles.promoCard}>
            <View style={styles.promoBadgeRow}>
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>{promo.badge}</Text>
              </View>
            </View>
            <View style={styles.promoBody}>
              <View style={styles.promoIconBox}>
                <Ionicons name={promo.icon} size={26} color={colors.secondary} />
              </View>
              <View style={styles.promoContent}>
                <Text style={styles.promoTitle}>{promo.title}</Text>
                <Text style={styles.promoDesc}>{promo.description}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Shop Announcement */}
        <View style={styles.announcement}>
          <Ionicons name="megaphone-outline" size={20} color={colors.primary} style={{ marginRight: spacing.sm }} />
          <Text style={styles.announcementText}>
            Extended hours this weekend — open Saturday 7AM to 6PM
          </Text>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xl },

  banner: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  bannerText: { flex: 1 },
  bannerGreeting: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  bannerTitle: {
    ...typography.h3,
    color: colors.white,
    marginBottom: 2,
  },
  bannerSub: {
    ...typography.small,
    color: 'rgba(255,255,255,0.5)',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    gap: spacing.sm,
  },
  bookBtnText: {
    ...typography.h4,
    color: colors.primary,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  seeAll: {
    ...typography.bodySmall,
    color: colors.primaryLight,
    fontWeight: '600',
  },

  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  quickAction: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    ...typography.small,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },

  promoCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  promoBadgeRow: { marginBottom: spacing.xs },
  promoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  promoBadgeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  promoBody: { flexDirection: 'row', alignItems: 'flex-start' },
  promoIconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(245,158,11,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  promoContent: { flex: 1 },
  promoTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  promoDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  announcement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  announcementText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
  bottomPad: { height: spacing.xl },
});
