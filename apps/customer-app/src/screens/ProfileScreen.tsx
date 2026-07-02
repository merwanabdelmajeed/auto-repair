import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../auth/CognitoService';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initials = user?.givenName && user?.familyName
    ? `${user.givenName[0]}${user.familyName[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const displayName = user?.givenName && user?.familyName
    ? `${user.givenName} ${user.familyName}`
    : user?.email ?? '';

  function openEdit() {
    setFirstName(user?.givenName ?? '');
    setLastName(user?.familyName ?? '');
    setPhone(user?.phone ?? '');
    setError('');
    setShowEdit(true);
  }

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateProfile(firstName.trim(), lastName.trim(), phone.trim());
      updateUser({ givenName: firstName.trim(), familyName: lastName.trim(), phone: phone.trim() || undefined });
      setShowEdit(false);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  const fields = [
    { icon: 'person-outline' as const, label: 'Full Name', value: displayName || '—' },
    { icon: 'mail-outline' as const, label: 'Email Address', value: user?.email ?? '—' },
    { icon: 'call-outline' as const, label: 'Phone Number', value: user?.phone || '—' },
  ];

  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar & Name */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.85}>
            <Ionicons name="pencil-outline" size={16} color={colors.white} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Fields */}
        <Text style={styles.sectionTitle}>Profile Information</Text>
        <View style={styles.fieldsCard}>
          {fields.map((field, i) => (
            <View key={field.label} style={[styles.fieldRow, i === fields.length - 1 && styles.fieldRowLast]}>
              <View style={styles.fieldIcon}>
                <Ionicons name={field.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldValue}>{field.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={confirmLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>First Name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Last Name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Phone Number <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(t) => setPhone(formatPhone(t))}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={styles.emailNote}>
              <Ionicons name="lock-closed-outline" size={12} color={colors.textMuted} /> Email address cannot be changed.
            </Text>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={() => void handleSave()}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
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
  initials: { ...typography.h2, color: colors.white },
  profileName: { ...typography.h3, color: colors.textPrimary, marginBottom: 4 },
  profileEmail: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  editBtnText: { ...typography.bodySmall, color: colors.white, fontWeight: '600' },

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
  fieldRowLast: { borderBottomWidth: 0 },
  fieldIcon: {
    width: 34, height: 34, borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md,
  },
  fieldContent: { flex: 1 },
  fieldLabel: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
  fieldValue: { ...typography.body, color: colors.textPrimary },

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
  signOutText: { ...typography.h4, color: colors.error },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.lg,
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySmall, color: colors.error },
  inputLabel: {
    ...typography.label, color: colors.textSecondary,
    marginBottom: 6, marginTop: spacing.md,
    textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5,
  },
  optional: { color: colors.textMuted, fontWeight: '400', textTransform: 'none' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    ...typography.body, color: colors.textPrimary, backgroundColor: colors.background,
  },
  emailNote: {
    ...typography.small, color: colors.textMuted,
    marginTop: spacing.sm, textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: colors.secondary, borderRadius: borderRadius.lg,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg, ...shadows.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.primary },
});
