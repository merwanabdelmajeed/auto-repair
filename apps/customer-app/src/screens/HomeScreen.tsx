import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listPromotions, type PublicPromotion } from '../api/promotions';
import { getCapacity, type DayHours } from '../api/capacity';
import { useAuth } from '../auth/AuthContext';
import { SHOP_ADDRESS } from '../constants';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function to12h(time: string): string {
  const m = time.match(/^(\d{2}):(\d{2})$/);
  if (!m) return time;
  const h = parseInt(m[1]!, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${ampm}`;
}

const QUICK_ACTIONS = [
  { icon: 'car-outline' as const, label: 'My Vehicles', screen: 'Vehicles' },
  { icon: 'pricetag-outline' as const, label: 'Promotions', screen: 'Promotions' },
  { icon: 'notifications-outline' as const, label: 'Notifications', screen: 'Notifications' },
];

function fmtExpiry(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function openNavigation(address: string) {
  const encoded = encodeURIComponent(address);
  const url = Platform.select({
    ios: `maps://?daddr=${encoded}`,
    android: `geo:0,0?q=${encoded}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
  });
  try {
    const supported = await Linking.canOpenURL(url);
    await Linking.openURL(supported ? url : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`);
  } catch {
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`);
  }
}

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [addressCopied, setAddressCopied] = useState(false);
  const [todayHours, setTodayHours] = useState<DayHours | null | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const displayName = user?.givenName && user?.familyName
    ? `${user.givenName} ${user.familyName}`
    : user?.email ?? '';

  async function copyAddress() {
    await Clipboard.setStringAsync(SHOP_ADDRESS);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  }

  const loadPromotions = useCallback(() => {
    setLoadingPromos(true);
    return listPromotions()
      .then(data => setPromotions(data.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoadingPromos(false));
  }, []);

  const loadCapacity = useCallback(() => {
    return getCapacity()
      .then(settings => {
        const todayName = DAY_NAMES[new Date().getDay()]!;
        setTodayHours(settings.operatingHours[todayName]);
      })
      .catch(() => setTodayHours(undefined));
  }, []);

  useFocusEffect(useCallback(() => { void loadPromotions(); }, [loadPromotions]));
  useFocusEffect(useCallback(() => { void loadCapacity(); }, [loadCapacity]));

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadPromotions(), loadCapacity()]);
    setRefreshing(false);
  }

  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.secondary} />}
      >
        {/* Welcome Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerInner}>
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

        {/* Location */}
        {SHOP_ADDRESS ? (
          <>
            <Text style={styles.sectionTitle}>Our Location</Text>
            <View style={styles.locationCard}>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={20} color={colors.secondary} style={{ marginRight: spacing.sm }} />
                <Text style={styles.locationAddress}>{SHOP_ADDRESS}</Text>
              </View>
              {todayHours !== undefined && (
                <View style={styles.hoursRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
                  {todayHours ? (
                    <Text style={styles.hoursText}>
                      Open today <Text style={styles.hoursTextBold}>{to12h(todayHours.open)} – {to12h(todayHours.close)}</Text>
                    </Text>
                  ) : (
                    <Text style={styles.hoursTextClosed}>Closed today</Text>
                  )}
                </View>
              )}
              <View style={styles.locationActions}>
                <TouchableOpacity style={styles.locationBtn} onPress={() => void copyAddress()} activeOpacity={0.75}>
                  <Ionicons name={addressCopied ? 'checkmark' : 'copy-outline'} size={16} color={colors.primary} />
                  <Text style={styles.locationBtnText}>{addressCopied ? 'Copied' : 'Copy'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.locationBtn, styles.locationBtnPrimary]}
                  onPress={() => void openNavigation(SHOP_ADDRESS)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="navigate" size={16} color={colors.white} />
                  <Text style={[styles.locationBtnText, styles.locationBtnTextPrimary]}>Navigate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        ) : null}

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

  locationCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  locationAddress: { ...typography.body, color: colors.textPrimary, flex: 1 },
  hoursRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  hoursText: { ...typography.bodySmall, color: colors.textSecondary },
  hoursTextBold: { fontWeight: '700', color: colors.textPrimary },
  hoursTextClosed: { ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic' },
  locationActions: { flexDirection: 'row', gap: spacing.sm },
  locationBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 10,
  },
  locationBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  locationBtnText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },
  locationBtnTextPrimary: { color: colors.white },

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
