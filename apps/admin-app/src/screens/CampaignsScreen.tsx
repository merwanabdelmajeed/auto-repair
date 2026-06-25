import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export default function CampaignsScreen() {
  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Ionicons name="megaphone" size={32} color={colors.secondary} style={{ marginBottom: spacing.sm }} />
          <Text style={styles.headerTitle}>Marketing Campaigns</Text>
          <Text style={styles.headerDesc}>
            Create email and push notification campaigns to re-engage customers and promote services.
          </Text>
          <TouchableOpacity style={styles.createBtn} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.createBtnText}>New Campaign</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Campaign Types</Text>
        <View style={styles.typeGrid}>
          {[
            { icon: 'mail-outline', title: 'Email Campaign', desc: 'Send via AWS SES (Phase 10)', color: '#3B82F6' },
            { icon: 'notifications-outline', title: 'Push Campaign', desc: 'Send via AWS SNS (Phase 10)', color: '#8B5CF6' },
          ].map((type) => (
            <View key={type.title} style={styles.typeCard}>
              <View style={[styles.typeIcon, { backgroundColor: type.color + '15' }]}>
                <Ionicons name={type.icon as any} size={26} color={type.color} />
              </View>
              <Text style={styles.typeTitle}>{type.title}</Text>
              <Text style={styles.typeDesc}>{type.desc}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Campaign Features (Phase 10)</Text>
        <View style={styles.featureCard}>
          {[
            'Audience segmentation (all customers, location-specific, new customers)',
            'Schedule campaigns for future delivery',
            'Track open rates, click-through, and conversions',
            'A/B testing for subject lines',
            'Campaign templates',
          ].map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginRight: spacing.sm }} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={36} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No Campaigns Yet</Text>
          <Text style={styles.emptyDesc}>Campaign management will be fully enabled in Phase 10.</Text>
        </View>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  headerCard: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    ...shadows.md,
  },
  headerTitle: { ...typography.h2, color: colors.white, marginBottom: spacing.sm, textAlign: 'center' },
  headerDesc: { ...typography.body, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 12, paddingHorizontal: spacing.xl, gap: spacing.sm },
  createBtnText: { ...typography.h4, color: colors.primary },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  typeGrid: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  typeCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  typeIcon: { width: 52, height: 52, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  typeTitle: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  typeDesc: { ...typography.small, color: colors.textSecondary, textAlign: 'center' },
  featureCard: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.md, borderRadius: borderRadius.xl, padding: spacing.md, ...shadows.sm },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  featureText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
});
