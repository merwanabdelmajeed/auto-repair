import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  function confirmLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  const initials = user?.email ? user.email[0].toUpperCase() : '?';

  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Account Card */}
        <View style={styles.accountCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountEmail}>{user?.email ?? '—'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>Customer</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          {[
            { icon: 'document-text-outline' as const, label: 'Terms of Service' },
            { icon: 'shield-outline' as const, label: 'Privacy Policy' },
            { icon: 'help-circle-outline' as const, label: 'Help & Support' },
            { icon: 'information-circle-outline' as const, label: 'App Version', value: '1.0.0' },
          ].map((item, i, arr) => (
            <View key={item.label} style={[styles.row, i === arr.length - 1 && styles.rowLast]}>
              <View style={styles.rowIcon}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <View style={styles.rowRight}>
                {item.value ? <Text style={styles.rowValue}>{item.value}</Text> : null}
                {!item.value && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
              </View>
            </View>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={confirmLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    margin: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: { ...typography.h2, color: colors.primary, fontSize: 22 },
  accountInfo: { flex: 1 },
  accountEmail: { ...typography.bodySmall, color: 'rgba(255,255,255,0.85)', marginBottom: 6, fontWeight: '500' },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  roleText: { fontSize: 11, fontWeight: '700', color: colors.secondary },

  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rowLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { ...typography.bodySmall, color: colors.textSecondary },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: borderRadius.xl,
    paddingVertical: 14,
  },
  signOutText: { ...typography.h4, color: colors.error },
});
