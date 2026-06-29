import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../auth/CognitoService';

export default function SettingsScreen() {
  const { user, logout, updateUser } = useAuth();
  const [showProfile, setShowProfile] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  function openProfile() {
    setFirstName(user?.givenName ?? '');
    setLastName(user?.familyName ?? '');
    setProfileError('');
    setShowProfile(true);
  }

  async function saveProfile() {
    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('First and last name are required.');
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    try {
      await updateProfile(firstName.trim(), lastName.trim());
      updateUser({ givenName: firstName.trim(), familyName: lastName.trim() });
      setShowProfile(false);
    } catch {
      setProfileError('Failed to save. Please try again.');
    } finally {
      setProfileSaving(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  const displayName = user?.givenName && user?.familyName
    ? `${user.givenName} ${user.familyName}`
    : user?.email ?? '';

  const SETTINGS = [
    {
      title: 'Location',
      items: [
        { type: 'link' as const, icon: 'business-outline' as const, label: 'Business Information', value: "Joe's Auto Repair" },
        { type: 'link' as const, icon: 'location-outline' as const, label: 'Manage Locations', value: '1 location' },
        { type: 'link' as const, icon: 'time-outline' as const, label: 'Business Hours', value: 'Configure' },
      ],
    },
    {
      title: 'Booking',
      items: [
        { type: 'toggle' as const, icon: 'calendar-outline' as const, label: 'Accept Online Bookings', value: true },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { type: 'toggle' as const, icon: 'notifications-outline' as const, label: 'Booking Alerts', value: true },
        { type: 'toggle' as const, icon: 'mail-outline' as const, label: 'Email Summaries', value: false },
      ],
    },
    {
      title: 'Account',
      items: [
        { type: 'action' as const, icon: 'person-outline' as const, label: 'Admin Profile', value: displayName, onPress: openProfile },
        { type: 'action' as const, icon: 'log-out-outline' as const, label: 'Sign Out', value: '', onPress: handleSignOut, danger: true },
      ],
    },
  ];

  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Admin banner */}
        <View style={styles.tenantBanner}>
          <View style={styles.tenantAvatar}>
            <Ionicons name="person" size={24} color={colors.secondary} />
          </View>
          <View style={styles.tenantInfo}>
            <Text style={styles.tenantName}>{displayName}</Text>
            <Text style={styles.tenantRole}>{user?.email ?? ''}</Text>
          </View>
          <TouchableOpacity onPress={openProfile}>
            <Ionicons name="pencil-outline" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {SETTINGS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.row, i === section.items.length - 1 && styles.rowLast]}
                  onPress={item.type === 'action' ? item.onPress : undefined}
                  activeOpacity={item.type === 'action' ? 0.7 : 1}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name={item.icon} size={18} color={'danger' in item && item.danger ? colors.error : colors.primary} />
                  </View>
                  <Text style={[styles.rowLabel, 'danger' in item && item.danger && styles.rowLabelDanger]}>{item.label}</Text>
                  {item.type === 'toggle' ? (
                    <Switch
                      value={item.value as boolean}
                      thumbColor={colors.white}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      onValueChange={() => {}}
                    />
                  ) : (
                    <View style={styles.rowRight}>
                      {item.value ? <Text style={styles.rowValue} numberOfLines={1}>{item.value}</Text> : null}
                      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.version}>AutoRepair Admin · Phase 4 · v1.0.0</Text>
      </ScrollView>

      {/* Profile Modal */}
      <Modal visible={showProfile} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Admin Profile</Text>
              <TouchableOpacity onPress={() => setShowProfile(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {profileError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{profileError}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={[styles.input, styles.inputReadOnly]}>
                <Text style={styles.inputReadOnlyText}>{user?.email ?? ''}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, profileSaving && styles.saveBtnDisabled]}
              onPress={() => void saveProfile()}
              disabled={profileSaving}
              activeOpacity={0.85}
            >
              {profileSaving
                ? <ActivityIndicator color={colors.primary} />
                : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  tenantBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary, padding: spacing.lg, marginBottom: spacing.sm,
  },
  tenantAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  tenantInfo: { flex: 1 },
  tenantName: { ...typography.h3, color: colors.white, marginBottom: 2 },
  tenantRole: { ...typography.small, color: 'rgba(255,255,255,0.6)' },

  sectionTitle: {
    ...typography.label, color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.8, paddingHorizontal: spacing.md,
    marginTop: spacing.lg, marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface, marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl, ...shadows.sm, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 34, height: 34, borderRadius: borderRadius.sm,
    backgroundColor: colors.background, justifyContent: 'center',
    alignItems: 'center', marginRight: spacing.md,
  },
  rowLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowLabelDanger: { color: colors.error },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: 140 },
  rowValue: { ...typography.bodySmall, color: colors.textSecondary },

  version: { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.textPrimary },

  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySmall, color: colors.error },

  field: { marginBottom: spacing.md },
  fieldLabel: {
    ...typography.label, color: colors.textSecondary, marginBottom: 6,
    textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    ...typography.body, color: colors.textPrimary, backgroundColor: colors.background,
  },
  inputReadOnly: { backgroundColor: colors.surface, justifyContent: 'center' },
  inputReadOnlyText: { ...typography.body, color: colors.textMuted },

  saveBtn: {
    backgroundColor: colors.secondary, borderRadius: borderRadius.lg,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm, ...shadows.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.primary },
});
