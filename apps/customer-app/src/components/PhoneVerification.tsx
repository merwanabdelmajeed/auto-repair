import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { sendPhoneCode, confirmPhoneCode } from '../api/verification';

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type Step = 'enter-phone' | 'enter-code' | 'verified';

// Optional in-app phone verification: the user enters a phone, receives a
// one-time passcode by SMS, and confirms it. Email remains the account gate —
// this only attaches a *verified* phone, so it never blocks anyone who skips it.
export default function PhoneVerification() {
  const [step, setStep] = useState<Step>('enter-phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const phoneValid = phone.replace(/\D/g, '').length === 10;

  async function handleSend() {
    if (!phoneValid) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPhoneCode(phone);
      setCode('');
      setStep('enter-code');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send a code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code we texted you.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await confirmPhoneCode(phone, code);
      setStep('verified');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not verify the code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Phone Verification</Text>
      <View style={styles.card}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 'verified' ? (
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            <Text style={styles.verifiedText}>{phone} is verified</Text>
          </View>
        ) : step === 'enter-code' ? (
          <>
            <Text style={styles.hint}>Enter the 6-digit code we texted to {phone}.</Text>
            <TextInput
              testID="phone-code-input"
              style={styles.input}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              testID="phone-verify-btn"
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.btnText}>Verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('enter-phone'); setError(''); }}>
              <Text style={styles.linkText}>Use a different number</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.hint}>Verify a phone number to get appointment updates by text.</Text>
            <TextInput
              testID="phone-input"
              style={styles.input}
              value={phone}
              onChangeText={(t) => setPhone(formatPhone(t))}
              placeholder="(555) 123-4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoComplete="tel"
            />
            <TouchableOpacity
              testID="phone-send-btn"
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => void handleSend()}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.btnText}>Send code</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.sm,
  },
  hint: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    ...typography.body, color: colors.textPrimary, backgroundColor: colors.background,
  },
  btn: {
    backgroundColor: colors.secondary, borderRadius: borderRadius.lg,
    paddingVertical: 14, alignItems: 'center', marginTop: spacing.md, ...shadows.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { ...typography.h4, color: colors.primary },
  linkText: { ...typography.bodySmall, color: colors.primary, textAlign: 'center', marginTop: spacing.md, fontWeight: '600' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: borderRadius.md,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  errorText: { ...typography.bodySmall, color: colors.error, flex: 1 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  verifiedText: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
});
