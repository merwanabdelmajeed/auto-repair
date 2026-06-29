import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { listBlockedTimes, createBlockedTime, deleteBlockedTime, type BlockedTime } from '../api/blockedTimes';

function fmtRange(startDate: string, endDate: string): string {
  const fmt = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}

function handleDateInput(text: string, prev: string): string {
  const isDeleting = text.length < prev.length;
  const digits = text.replace(/\D/g, '').slice(0, 8);
  let f = digits;
  if (digits.length > 4 || (!isDeleting && digits.length === 4)) f = `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (digits.length > 6 || (!isDeleting && digits.length === 6)) f = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  return f;
}

export default function BlockedTimesScreen() {
  const [blockedTimes, setBlockedTimes] = useState<BlockedTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await listBlockedTimes();
      setBlockedTimes(data);
    } catch {
      Alert.alert('Error', 'Failed to load blocked times.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openModal() {
    setLabel('');
    setStartDate('');
    setEndDate('');
    setModalError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!label.trim()) { setModalError('Label is required.'); return; }
    if (!startDate.match(/^\d{4}-\d{2}-\d{2}$/) || !endDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setModalError('Enter dates in YYYY-MM-DD format.');
      return;
    }
    if (startDate > endDate) { setModalError('Start date must be on or before end date.'); return; }

    setSaving(true);
    setModalError('');
    try {
      const created = await createBlockedTime({ label: label.trim(), startDate, endDate });
      setBlockedTimes(prev => [...prev, created].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setShowModal(false);
    } catch {
      setModalError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(bt: BlockedTime) {
    Alert.alert('Remove Block', `Remove "${bt.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            await deleteBlockedTime(bt.blockedTimeId);
            setBlockedTimes(prev => prev.filter(b => b.blockedTimeId !== bt.blockedTimeId));
          } catch {
            Alert.alert('Error', 'Failed to remove blocked time.');
          }
        },
      },
    ]);
  }

  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      >
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.infoText}>
            Blocked times prevent customers from booking on those dates. Use for holidays, vacations, or any shop closures.
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : blockedTimes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Blocked Times</Text>
            <Text style={styles.emptyDesc}>Tap + to block dates for holidays or closures.</Text>
          </View>
        ) : (
          blockedTimes.map(bt => (
            <View key={bt.blockedTimeId} style={styles.card}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardLabel}>{bt.label}</Text>
                <Text style={styles.cardDates}>{fmtRange(bt.startDate, bt.endDate)}</Text>
              </View>
              <TouchableOpacity onPress={() => confirmDelete(bt)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Block Dates</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {modalError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{modalError}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Label</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Independence Day, Staff Training"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Start Date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={text => setStartDate(handleDateInput(text, startDate))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>End Date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={text => setEndDate(handleDateInput(text, endDate))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={10}
            />

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={() => void handleSave()} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 100 },
  center: { paddingVertical: spacing.xxl, alignItems: 'center' },

  infoCard: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: 'rgba(15,32,68,0.05)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: 'rgba(15,32,68,0.12)' },
  infoText: { flex: 1, ...typography.small, color: colors.textSecondary, lineHeight: 18 },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary },
  emptyDesc: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', ...shadows.sm },
  cardLeft: { flex: 1 },
  cardLabel: { ...typography.h4, color: colors.textPrimary, marginBottom: 2 },
  cardDates: { ...typography.bodySmall, color: colors.textSecondary },
  deleteBtn: { padding: 6 },

  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', ...shadows.lg },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  modalTitle: { ...typography.h3, color: colors.textPrimary },

  errorBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.error },

  fieldLabel: { ...typography.label, color: colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 12, ...typography.body, color: colors.textPrimary, backgroundColor: colors.background },

  saveBtn: { backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg, ...shadows.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.primary },
});
