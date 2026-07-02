import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listPromotions, type PublicPromotion } from '../api/promotions';
import { useAuth } from '../auth/AuthContext';

const QUICK_ACTIONS = [
  { icon: 'car-outline' as const, label: 'My Vehicles', screen: 'Vehicles' },
  { icon: 'pricetag-outline' as const, label: 'Promotions', screen: 'Promotions' },
  { icon: 'notifications-outline' as const, label: 'Notifications', screen: 'Notifications' },
];

function fmtExpiry(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);

  const displayName = user?.givenName && user?.familyName
    ? `${user.givenName} ${user.familyName}`
    : user?.email ?? '';

  useFocusEffect(useCallback(() => {
    setLoadingPromos(true);
    listPromotions()
      .then(data => setPromotions(data.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoadingPromos(false));
  }, []));

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
              <Text style={styles.bannerGreeting}>Welcome back,</Text>
              <Text style={styles.bannerTitle}>{displayName}</Text>
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

        {loadingPromos ? (
          <ActivityIndicator size="small" color={colors.secondary} style={{ marginVertical: spacing.md }} />
        ) : promotions.length === 0 ? (
          <View style={styles.emptyPromos}>
            <Text style={styles.emptyPromosText}>No active promotions right now.</Text>
          </View>
        ) : promotions.map((promo) => {
          const expiry = fmtExpiry(promo.expiresAt);
          const badge = promo.type === 'percent' ? `${promo.value}% OFF` : `$${promo.value} OFF`;
          return (
            <TouchableOpacity
              key={promo.promoId}
              style={styles.promoCard}
              onPress={() => navigation.navigate('Promotions')}
              activeOpacity={0.85}
            >
              <View style={styles.promoBadgeRow}>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>{badge}</Text>
                </View>
                {expiry && <Text style={styles.promoExpiry}>Expires {expiry}</Text>}
              </View>
              <View style={styles.promoBody}>
                <View style={styles.promoIconBox}>
                  <Ionicons name="pricetag-outline" size={26} color={colors.secondary} />
                </View>
                <View style={styles.promoContent}>
                  <Text style={styles.promoCode}>{promo.code}</Text>
                  <Text style={styles.promoDesc}>{promo.description}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

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
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  bannerTitle: {
    ...typography.h2,
    color: colors.white,
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

  emptyPromos: {
    marginHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  emptyPromosText: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
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
  promoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
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
  promoExpiry: {
    ...typography.small,
    color: colors.textMuted,
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
  promoCode: {
    ...typography.h4,
    color: colors.textPrimary,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  promoDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },

  bottomPad: { height: spacing.xl },
});
