import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme';
import type { Appointment } from '../api/appointments';

// Customer section of the appointment detail sheet (Dashboard + Bookings).
// The name opens the customer's details on the Customers screen — unless the
// account was deleted (no customerId), in which case it's plain text.
type Props = {
  appt: Appointment;
  phone: string | null | undefined;
  onOpenCustomer: (customerId: string) => void;
};

export default function AppointmentCustomerCard({ appt, phone, onOpenCustomer }: Props) {
  const customerId = appt.customerId;
  return (
    <View style={styles.infoCard}>
      {appt.customerName ? (
        customerId ? (
          <TouchableOpacity
            testID="appt-customer-link"
            style={[styles.infoRow, styles.linkRow]}
            onPress={() => onOpenCustomer(customerId)}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={15} color={colors.primary} />
            <Text style={[styles.infoValue, styles.name]}>{appt.customerName}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={15} color={colors.textMuted} />
            <Text style={[styles.infoValue, styles.name]}>{appt.customerName}</Text>
          </View>
        )
      ) : null}
      <View style={styles.infoRow}>
        <Ionicons name="call-outline" size={15} color={colors.textMuted} />
        <Text style={styles.infoValue}>{phone || '—'}</Text>
      </View>
      <View style={[styles.infoRow, styles.infoRowLast]}>
        <Ionicons name="mail-outline" size={15} color={colors.textMuted} />
        <Text style={styles.infoValue}>{appt.customerEmail || '—'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  infoCard: { backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoRowLast: { borderBottomWidth: 0 },
  linkRow: { alignItems: 'center' },
  infoValue: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  name: { fontWeight: '600' },
});
