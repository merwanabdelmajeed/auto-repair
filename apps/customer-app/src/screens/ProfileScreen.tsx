import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { updateProfile } from '../auth/CognitoService';
import { getMyProfile, updateMyProfile } from '../api/users';
import { formatPhone } from '../utils/phone';
import { cleanAddress, formatAddress, type Address } from '../utils/address';

const ADDRESS_INPUTS: { key: keyof Address; label: string; placeholder: string; numeric?: boolean }[] = [
  { key: 'line1', label: 'Street Address', placeholder: '123 Main St' },
  { key: 'line2', label: 'Apt, Suite, Unit', placeholder: 'Apt 4B' },
  { key: 'city', label: 'City', placeholder: 'Lake Forest' },
  { key: 'state', label: 'State', placeholder: 'CA' },
  { key: 'postalCode', label: 'ZIP Code', placeholder: '92630', numeric: true },
];

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Phone and address come from the API (DynamoDB), not the Cognito token —
  // refetched on every visit so a change made by the shop shows up here too.
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [address, setAddress] = useState<Address | null>(null);
  const [addressInput, setAddressInput] = useState<Address>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initials = user?.givenName && user?.familyName
    ? `${user.givenName[0]}${user.familyName[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const displayName = user?.givenName && user?.familyName
    ? `${user.givenName} ${user.familyName}`
    : user?.email ?? '';

  useFocusEffect(useCallback(() => {
    getMyProfile()
      .then(p => {
        setPhone(p.phone);
        setAddress(p.address);
      })
      .catch(() => { /* leave the phone/address rows as "—" */ });
  }, []));

  function openEdit() {
    setFirstName(user?.givenName ?? '');
    setLastName(user?.familyName ?? '');
    setPhoneInput(phone ?? '');
    setAddressInput({ ...(address ?? {}) });
    setError('');
    setShowEdit(true);
  }

  async function handleSave() {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    // Required (as at signup) but not validated beyond that.
    if (!phoneInput.trim()) {
      setError('Phone number is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await updateProfile(firstName.trim(), lastName.trim());
      // Persist to the DynamoDB USERS record too — Cognito alone leaves the
      // admin Customers list showing the old name. Phone and address live only
      // there. Address is optional: an all-blank form clears it.
      const newAddress = cleanAddress(addressInput) ?? null;
      await updateMyProfile(firstName.trim(), lastName.trim(), phoneInput.trim(), newAddress);
      updateUser({ givenName: firstName.trim(), familyName: lastName.trim() });
      setPhone(phoneInput.trim());
      setAddress(newAddress);
      setShowEdit(false);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { icon: 'person-outline' as const, label: 'Full Name', value: displayName || '—' },
    { icon: 'mail-outline' as const, label: 'Email Address', value: user?.email ?? '—' },
    { icon: 'call-outline' as const, label: 'Phone Number', value: phone ?? '—' },
    { icon: 'location-outline' as const, label: 'Address', value: formatAddress(address) ?? '—' },
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

      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity testID="profile-edit-close" onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phoneInput}
                onChangeText={t => setPhoneInput(formatPhone(t))}
                placeholder="(555) 555-5555"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                autoComplete="tel"
              />

              <Text style={styles.addressHeading}>
                Address <Text style={styles.optional}>(optional)</Text>
              </Text>
              {ADDRESS_INPUTS.map(f => (
                <React.Fragment key={f.key}>
                  <Text style={styles.inputLabel}>{f.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={addressInput[f.key] ?? ''}
                    onChangeText={t => setAddressInput(a => ({ ...a, [f.key]: t }))}
                    placeholder={f.placeholder}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize={f.key === 'state' ? 'characters' : 'words'}
                    keyboardType={f.numeric ? 'number-pad' : 'default'}
                  />
                </React.Fragment>
              ))}

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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, paddingBottom: 40,
    maxHeight: '90%',
  },
  addressHeading: {
    ...typography.h4, color: colors.textPrimary,
    marginTop: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  optional: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '400' },
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
