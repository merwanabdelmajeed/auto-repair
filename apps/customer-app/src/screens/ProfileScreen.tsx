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

export default function ProfileScreen() {
  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar & Name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={44} color={colors.white} />
          </View>
          <Text style={styles.profileName}>Guest User</Text>
          <Text style={styles.profileEmail}>Sign in to access your profile</Text>
          <TouchableOpacity style={styles.signInBtn} activeOpacity={0.85}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Fields */}
        <Text style={styles.sectionTitle}>Profile Information</Text>
        <View style={styles.fieldsCard}>
          {[
            { icon: 'person-outline', label: 'Full Name', placeholder: '—' },
            { icon: 'mail-outline', label: 'Email Address', placeholder: '—' },
            { icon: 'call-outline', label: 'Phone Number', placeholder: '—' },
            { icon: 'location-outline', label: 'Preferred Location', placeholder: 'Not set' },
          ].map((field) => (
            <View key={field.label} style={styles.fieldRow}>
              <Ionicons name={field.icon as any} size={18} color={colors.textSecondary} style={styles.fieldIcon} />
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldValue}>{field.placeholder}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          ))}
        </View>

        {/* Account Actions */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.actionsCard}>
          {[
            { icon: 'key-outline', label: 'Change Password', color: colors.textPrimary },
            { icon: 'notifications-outline', label: 'Notification Preferences', color: colors.textPrimary },
            { icon: 'shield-outline', label: 'Privacy Settings', color: colors.textPrimary },
            { icon: 'trash-outline', label: 'Delete Account', color: colors.error },
          ].map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <Ionicons name={action.icon as any} size={20} color={action.color} style={styles.actionIcon} />
              <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.8}>
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

  profileHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  profileName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  signInBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.xxl,
  },
  signInBtnText: {
    ...typography.h4,
    color: colors.white,
  },

  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  fieldsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  fieldIcon: { marginRight: spacing.md },
  fieldContent: { flex: 1 },
  fieldLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  fieldValue: {
    ...typography.body,
    color: colors.textPrimary,
  },

  actionsCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  actionIcon: { marginRight: spacing.md },
  actionLabel: {
    ...typography.body,
    flex: 1,
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.error,
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  signOutText: {
    ...typography.h4,
    color: colors.error,
  },
});
