import React, { useState } from 'react';
import { SHOP_NAME, PRIVACY_POLICY_URL } from '../constants';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
type Props = {
  onNavigateToLogin: () => void;
  onRegistered: (email: string, password: string) => void;
};

// For MVP, tenant ID is hardcoded. Replace with invitation-code flow in a later phase.
const DEFAULT_TENANT_ID = 'demo-tenant';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function RegisterScreen({ onNavigateToLogin, onRegistered }: Props) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handlePhoneChange(text: string) {
    const formatted = formatPhone(text);
    setPhone(formatted);
    if (!formatted) setSmsConsent(false);
  }

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email || !password || !confirm) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedPhone = phone.trim();
      await register(
        trimmedEmail, password, DEFAULT_TENANT_ID, firstName.trim(), lastName.trim(),
        trimmedPhone || undefined, trimmedPhone ? smsConsent : undefined,
      );
      onRegistered(trimmedEmail, password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="construct" size={36} color={colors.secondary} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join {SHOP_NAME}</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jane"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoComplete="given-name"
              />
            </View>
            <View style={styles.nameField}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Smith"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoComplete="family-name"
              />
            </View>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Text style={styles.label}>Phone <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="(555) 123-4567"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            autoComplete="tel"
          />

          {phone ? (
            <TouchableOpacity
              testID="register-sms-consent"
              style={styles.consentRow}
              onPress={() => setSmsConsent((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={smsConsent ? 'checkbox' : 'square-outline'}
                size={20}
                color={smsConsent ? colors.primary : colors.textMuted}
              />
              <Text style={styles.consentText}>
                I agree to receive SMS text messages from {SHOP_NAME} (appointment reminders,
                service updates, and promotions). Message frequency varies. Message & data rates
                may apply. Reply STOP to opt out, HELP for help. See our{' '}
                <Text style={styles.consentLink} onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}>
                  Privacy Policy
                </Text>.
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
            />
            <TouchableOpacity
              testID="register-toggle-password"
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
          />

          <TouchableOpacity
            testID="register-submit-btn"
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={styles.btnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={onNavigateToLogin}
          >
            <Text style={styles.linkText}>
              Already have an account?{' '}
              <Text style={styles.link}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  title: { ...typography.h2, color: colors.primary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: { ...typography.bodySmall, color: colors.error, flex: 1 },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  nameField: { flex: 1 },
  label: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  optional: { color: colors.textMuted, fontWeight: '400' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  consentText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 18 },
  consentLink: { color: colors.primary, fontWeight: '600' },
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  btn: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { ...typography.h4, color: colors.primary },
  linkRow: { alignItems: 'center', marginTop: spacing.md },
  linkText: { ...typography.bodySmall, color: colors.textSecondary },
  link: { color: colors.primary, fontWeight: '600' },
});
