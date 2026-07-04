import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, Clipboard, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listPromotions, type PublicPromotion } from '../api/promotions';

function fmtExpiry(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDiscount(p: PublicPromotion) {
  return p.type === 'percent' ? `${p.value}% off` : `$${p.value.toFixed(2)} off`;
}

export default function PromotionsScreen() {
  const [promos, setPromos] = useState<PublicPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setPromos(await listPromotions());
    } catch {
      // Silently fail — not critical
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function onRefresh() {
    setRefreshing(true);
    try {
      setPromos(await listPromotions());
    } catch {
      // Silently fail — not critical
    } finally {
      setRefreshing(false);
    }
  }

  function copyCode(code: string) {
    Clipboard.setString(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.secondary} />}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Current Offers</Text>
          <Text style={styles.pageSubtitle}>
            Tap a code to copy it, then enter it at checkout when booking.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : promos.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="pricetag-outline" size={44} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Active Offers</Text>
            <Text style={styles.emptyDesc}>
              Check back soon — promotions will appear here when available.
            </Text>
          </View>
        ) : (
          promos.map(p => (
            <TouchableOpacity
              key={p.promoId}
              style={styles.card}
              onPress={() => copyCode(p.code)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{formatDiscount(p)}</Text>
                </View>
                {copiedCode === p.code ? (
                  <View style={styles.copiedTag}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                    <Text style={styles.copiedTagText}>Copied!</Text>
                  </View>
                ) : (
                  <View style={styles.copyTag}>
                    <Ionicons name="copy-outline" size={13} color={colors.textMuted} />
                    <Text style={styles.copyTagText}>Tap to copy</Text>
                  </View>
                )}
              </View>

              <Text style={styles.code}>{p.code}</Text>
              {p.description ? <Text style={styles.description}>{p.description}</Text> : null}

              {p.expiresAt && (
                <View style={styles.expiryRow}>
                  <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.expiryText}>Expires {fmtExpiry(p.expiresAt)}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.noticeText}>
            One promo code per appointment. Enter your code on the booking confirmation screen.
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
  pageTitle: { ...typography.h2, color: colors.textPrimary, marginBottom: 4 },
  pageSubtitle: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },

  center: { paddingTop: spacing.xxl, alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.md, ...shadows.sm,
  },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  discountBadge: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  discountText: { fontSize: 13, fontWeight: '800', color: colors.primary },
  copyTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyTagText: { ...typography.small, color: colors.textMuted },
  copiedTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copiedTagText: { ...typography.small, color: colors.success, fontWeight: '600' },

  code: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  expiryRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expiryText: { ...typography.small, color: colors.textMuted },

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
