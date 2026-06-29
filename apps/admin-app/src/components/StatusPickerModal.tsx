import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme';
import type { AppointmentStatus } from '../api/appointments';

function statusLabel(s: AppointmentStatus) {
  return s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

const FORWARD_COLOR: Partial<Record<AppointmentStatus, { bg: string; text: string; border: string }>> = {
  confirmed:     { bg: 'rgba(37,99,235,0.08)',  text: '#2563EB', border: 'rgba(37,99,235,0.3)' },
  'in-progress': { bg: 'rgba(124,58,237,0.08)', text: '#7C3AED', border: 'rgba(124,58,237,0.3)' },
  completed:     { bg: 'rgba(22,163,74,0.08)',  text: '#16A34A', border: 'rgba(22,163,74,0.3)' },
};

interface Props {
  visible: boolean;
  currentStatus: AppointmentStatus;
  validNext: AppointmentStatus[];
  onSelect: (status: AppointmentStatus) => void;
  onDismiss: () => void;
}

export default function StatusPickerModal({ visible, currentStatus, validNext, onSelect, onDismiss }: Props) {
  const forwardOpts = validNext.filter(s => s !== 'cancelled');
  const canCancel = validNext.includes('cancelled');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Change Status</Text>
        <Text style={styles.current}>Currently: <Text style={styles.currentBold}>{statusLabel(currentStatus)}</Text></Text>

        {forwardOpts.map(s => {
          const c = FORWARD_COLOR[s];
          return (
            <TouchableOpacity
              key={s}
              style={[styles.forwardBtn, c && { backgroundColor: c.bg, borderColor: c.border }]}
              onPress={() => { onDismiss(); onSelect(s); }}
              activeOpacity={0.75}
            >
              <Text style={[styles.forwardBtnText, c && { color: c.text }]}>
                Move to {statusLabel(s)}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.bottomRow}>
          {canCancel && (
            <TouchableOpacity
              style={styles.cancelApptBtn}
              onPress={() => { onDismiss(); onSelect('cancelled'); }}
              activeOpacity={0.75}
            >
              <Text style={styles.cancelApptBtnText}>Cancel Appointment</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.dismissBtn, !canCancel && styles.dismissBtnFull]} onPress={onDismiss} activeOpacity={0.75}>
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  current: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  currentBold: {
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  forwardBtn: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  forwardBtnText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelApptBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.35)',
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.05)',
  },
  cancelApptBtnText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: '#DC2626',
  },
  dismissBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  dismissBtnFull: {
    flex: 1,
  },
  dismissBtnText: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
