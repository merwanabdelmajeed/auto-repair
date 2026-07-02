import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Switch, Platform,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  listPromotions, createPromotion, updatePromotion, deletePromotion,
  type Promotion,
} from '../api/promotions';

type PromoForm = {
  code: string;
  description: string;
  type: 'percent' | 'fixed';
  value: number;
  maxUsesStr: string;
  expiresAtStr: string;
  isActive: boolean;
};

const EMPTY_FORM: PromoForm = {
  code: '', description: '', type: 'percent', value: 10, maxUsesStr: '', expiresAtStr: '', isActive: true,
};

function formatValue(p: Promotion) {
  return p.type === 'percent' ? `${p.value}% off` : `$${p.value.toFixed(2)} off`;
}

function fmtDate(iso: string) {
  const d = new Date(iso.length === 10 ? iso + 'T23:59:59' : iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function promoToForm(p: Promotion): PromoForm {
  return {
    code: p.code,
    description: p.description ?? '',
    type: p.type,
    value: p.value,
    maxUsesStr: p.maxUses !== null ? String(p.maxUses) : '',
    expiresAtStr: p.expiresAt
      ? new Date(p.expiresAt.length === 10 ? p.expiresAt + 'T23:59:59' : p.expiresAt)
          .toLocaleDateString('en-CA')
      : '',
    isActive: p.isActive,
  };
}

export default function PromotionsScreen() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [detailPromo, setDetailPromo] = useState<Promotion | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setPromos(await listPromotions());
    } catch {
      Alert.alert('Error', 'Failed to load promotions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openAdd() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(p: Promotion) {
    setDetailPromo(null);
    setEditTarget(p);
    setForm(promoToForm(p));
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditTarget(null);
    setShowDatePicker(false);
  }

  async function handleSave() {
    if (!form.value || form.value <= 0) { setFormError('Value must be greater than 0.'); return; }
    if (form.type === 'percent' && form.value > 100) { setFormError('Percent discount cannot exceed 100.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const maxUses = form.maxUsesStr ? parseInt(form.maxUsesStr, 10) : null;
      const expiresAt = form.expiresAtStr.trim()
        ? new Date(form.expiresAtStr + 'T23:59:59').toISOString()
        : null;

      if (!editTarget) {
        if (!form.code.trim()) { setFormError('Promo code is required.'); setSaving(false); return; }
        const created = await createPromotion({
          code: form.code,
          description: form.description,
          type: form.type,
          value: form.value,
          maxUses: maxUses && maxUses > 0 ? maxUses : null,
          expiresAt,
        });
        setPromos(prev => [created, ...prev]);
      } else {
        const updated = await updatePromotion(editTarget.promoId, {
          description: form.description,
          type: form.type,
          value: form.value,
          maxUses: maxUses && maxUses > 0 ? maxUses : null,
          expiresAt,
        });
        setPromos(prev => prev.map(p => p.promoId === editTarget.promoId ? updated : p));
      }
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Promotion) {
    try {
      const updated = await updatePromotion(p.promoId, { isActive: !p.isActive });
      setPromos(prev => prev.map(x => x.promoId === p.promoId ? updated : x));
      if (detailPromo?.promoId === p.promoId) setDetailPromo(updated);
    } catch {
      Alert.alert('Error', 'Failed to update promotion.');
    }
  }

  function confirmDelete(p: Promotion) {
    Alert.alert('Delete Promotion', `Delete code "${p.code}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deletePromotion(p.promoId);
            setPromos(prev => prev.filter(x => x.promoId !== p.promoId));
            if (detailPromo?.promoId === p.promoId) setDetailPromo(null);
          } catch {
            Alert.alert('Error', 'Failed to delete promotion.');
          }
        },
      },
    ]);
  }

  const shown = promos.filter(p => {
    if (filterActive === 'active') return p.isActive;
    if (filterActive === 'inactive') return !p.isActive;
    return true;
  });

  return (
    <Layout>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.filterRow}>
            {(['all', 'active', 'inactive'] as const).map(f => (
              <TouchableOpacity key={f} onPress={() => setFilterActive(f)} style={[styles.filterChip, filterActive === f && styles.filterChipActive]}>
                <Text style={[styles.filterText, filterActive === f && styles.filterTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {shown.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="pricetag-outline" size={48} color={colors.textMuted} /></View>
              <Text style={styles.emptyTitle}>No Promotions</Text>
              <Text style={styles.emptyDesc}>Create discount codes that customers can apply when booking.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd} activeOpacity={0.85}>
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={styles.emptyBtnText}>Create Promotion</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Promotions ({shown.length})</Text>
              {shown.map(p => {
                const expiryDate = p.expiresAt ? new Date(p.expiresAt.length === 10 ? p.expiresAt + 'T23:59:59' : p.expiresAt) : null;
                const expired = expiryDate ? expiryDate < new Date() : false;
                const maxed = p.maxUses !== null && p.usedCount >= p.maxUses;
                return (
                  <TouchableOpacity key={p.promoId} style={styles.card} onPress={() => setDetailPromo(p)} activeOpacity={0.85}>
                    <View style={styles.cardTop}>
                      <View style={styles.codeRow}>
                        <Text style={styles.code}>{p.code}</Text>
                        <View style={[styles.typeBadge, p.type === 'percent' ? styles.typeBadgePercent : styles.typeBadgeFixed]}>
                          <Text style={[styles.typeBadgeText, p.type === 'percent' ? styles.typeBadgeTextPercent : styles.typeBadgeTextFixed]}>
                            {formatValue(p)}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={e => { confirmDelete(p); }} style={styles.actionBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                    {p.description ? <Text style={styles.cardDesc}>{p.description}</Text> : null}
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardMetaText}>Used: {p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ''}</Text>
                      {p.expiresAt && (
                        <Text style={[styles.cardMetaText, expired && styles.expiredText]}>
                          {expired ? 'Expired ' : 'Expires '}{fmtDate(p.expiresAt)}
                        </Text>
                      )}
                      {expired || maxed ? (
                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(148,163,184,0.15)' }]}>
                          <Text style={[styles.statusBadgeText, { color: colors.textMuted }]}>
                            {expired ? 'Expired' : 'Maxed'}
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.statusBadge, { backgroundColor: p.isActive ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.15)' }]}>
                          <Text style={[styles.statusBadgeText, { color: p.isActive ? colors.success : colors.textMuted }]}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {!loading && (
        <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

      {/* Detail Modal */}
      <Modal visible={!!detailPromo} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {detailPromo && (() => {
              const p = detailPromo;
              const expiryDate = p.expiresAt ? new Date(p.expiresAt.length === 10 ? p.expiresAt + 'T23:59:59' : p.expiresAt) : null;
              const expired = expiryDate ? expiryDate < new Date() : false;
              const maxed = p.maxUses !== null && p.usedCount >= p.maxUses;
              return (
                <>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{p.code}</Text>
                    <TouchableOpacity onPress={() => setDetailPromo(null)}>
                      <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Discount badge */}
                    <View style={[styles.typeBadge, { alignSelf: 'flex-start', marginBottom: spacing.md, paddingHorizontal: 12, paddingVertical: 5 }, p.type === 'percent' ? styles.typeBadgePercent : styles.typeBadgeFixed]}>
                      <Text style={[styles.typeBadgeText, { fontSize: 14 }, p.type === 'percent' ? styles.typeBadgeTextPercent : styles.typeBadgeTextFixed]}>
                        {formatValue(p)}
                      </Text>
                    </View>

                    <Text style={styles.detailLabel}>DETAILS</Text>
                    <View style={styles.infoCard}>
                      {p.description ? (
                        <View style={styles.infoRow}>
                          <Ionicons name="document-text-outline" size={15} color={colors.textMuted} />
                          <Text style={styles.infoValue}>{p.description}</Text>
                        </View>
                      ) : null}
                      <View style={styles.infoRow}>
                        <Ionicons name="bar-chart-outline" size={15} color={colors.textMuted} />
                        <Text style={styles.infoValue}>Used {p.usedCount}{p.maxUses ? ` of ${p.maxUses}` : ' times'}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={15} color={expired ? colors.error : colors.textMuted} />
                        <Text style={[styles.infoValue, expired && { color: colors.error }]}>
                          {p.expiresAt ? (expired ? 'Expired ' : 'Expires ') + fmtDate(p.expiresAt) : 'No expiry date'}
                        </Text>
                      </View>
                      <View style={[styles.infoRow, styles.infoRowLast]}>
                        <Ionicons name="power-outline" size={15} color={colors.textMuted} />
                        <Text style={[styles.infoValue, { color: expired || maxed ? colors.textMuted : p.isActive ? colors.success : colors.textMuted }]}>
                          {expired ? 'Expired' : maxed ? 'Maxed out' : p.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>

                    {/* Toggle active (only if not expired/maxed) */}
                    {!expired && !maxed && (
                      <View style={styles.toggleCard}>
                        <Text style={styles.toggleCardLabel}>Active</Text>
                        <Switch
                          value={p.isActive}
                          onValueChange={() => void toggleActive(p)}
                          trackColor={{ false: colors.border, true: colors.primary }}
                          thumbColor={colors.white}
                          style={styles.toggleSwitch}
                        />
                      </View>
                    )}

                    {/* Actions */}
                    <View style={styles.detailActions}>
                      <TouchableOpacity onPress={() => openEdit(p)} style={styles.detailEditBtn} activeOpacity={0.8}>
                        <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                        <Text style={styles.detailEditBtnText}>Edit Promotion</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(p)} style={styles.detailDeleteBtn} activeOpacity={0.8}>
                        <Ionicons name="trash-outline" size={16} color={colors.error} />
                        <Text style={styles.detailDeleteBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Create / Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editTarget ? 'Edit Promotion' : 'Create Promotion'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {formError ? (
                <View style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View>
              ) : null}

              <Text style={styles.fieldLabel}>Promo Code</Text>
              {editTarget ? (
                <View style={[styles.input, { backgroundColor: colors.background }]}>
                  <Text style={{ ...typography.body, color: colors.primary, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 }}>{editTarget.code}</Text>
                </View>
              ) : (
                <TextInput
                  style={styles.input}
                  value={form.code}
                  onChangeText={v => setForm(p => ({ ...p, code: v.toUpperCase().replace(/\s/g, '') }))}
                  placeholder="e.g. SUMMER20"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              )}

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={form.description}
                onChangeText={v => setForm(p => ({ ...p, description: v }))}
                placeholder="e.g. 20% off all services this summer"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Discount Type *</Text>
              <View style={styles.typeRow}>
                {(['percent', 'fixed'] as const).map(t => (
                  <TouchableOpacity key={t} style={[styles.typeChip, form.type === t && styles.typeChipActive]} onPress={() => setForm(p => ({ ...p, type: t }))} activeOpacity={0.8}>
                    <Text style={[styles.typeChipText, form.type === t && styles.typeChipTextActive]}>
                      {t === 'percent' ? '% Percent' : '$ Fixed Amount'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{form.type === 'percent' ? 'Percent Off *' : 'Amount Off ($) *'}</Text>
                  <TextInput style={styles.input} value={String(form.value)} onChangeText={v => setForm(p => ({ ...p, value: parseFloat(v) || 0 }))} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Max Uses</Text>
                  <TextInput style={styles.input} value={form.maxUsesStr} onChangeText={v => setForm(p => ({ ...p, maxUsesStr: v }))} keyboardType="number-pad" placeholder="Unlimited" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Expires At</Text>
              <TouchableOpacity style={[styles.input, styles.dateBtn]} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.dateBtnText, !form.expiresAtStr && styles.dateBtnPlaceholder]}>
                  {form.expiresAtStr ? fmtDate(form.expiresAtStr) : 'No expiry date'}
                </Text>
                {form.expiresAtStr ? (
                  <TouchableOpacity onPress={() => setForm(p => ({ ...p, expiresAtStr: '' }))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>

              {showDatePicker && Platform.OS === 'ios' && (
                <View style={styles.iosPickerWrap}>
                  <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.iosPickerDoneText}>Done</Text>
                  </TouchableOpacity>
                  <DateTimePicker
                    value={form.expiresAtStr ? new Date(form.expiresAtStr + 'T12:00:00') : new Date()}
                    mode="date"
                    display="spinner"
                    minimumDate={new Date()}
                    onChange={(_: DateTimePickerEvent, date?: Date) => {
                      if (date) setForm(p => ({ ...p, expiresAtStr: date.toLocaleDateString('en-CA') }));
                    }}
                  />
                </View>
              )}
              {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                  value={form.expiresAtStr ? new Date(form.expiresAtStr + 'T12:00:00') : new Date()}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(_: DateTimePickerEvent, date?: Date) => {
                    setShowDatePicker(false);
                    if (date) setForm(p => ({ ...p, expiresAtStr: date.toLocaleDateString('en-CA') }));
                  }}
                />
              )}

              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={() => void handleSave()} disabled={saving} activeOpacity={0.85}>
                {saving
                  ? <ActivityIndicator color={colors.primary} />
                  : <Text style={styles.saveBtnText}>{editTarget ? 'Save Changes' : 'Create Promotion'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Layout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { paddingBottom: 100 },

  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm, marginVertical: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: borderRadius.round, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: colors.white },

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 12, paddingHorizontal: spacing.lg },
  emptyBtnText: { ...typography.h4, color: colors.primary },

  sectionTitle: { ...typography.h4, color: colors.textPrimary, paddingHorizontal: spacing.md, marginBottom: spacing.sm },

  card: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  code: { ...typography.h4, color: colors.primary, fontFamily: 'monospace' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.xs, borderWidth: 1 },
  typeBadgePercent: { backgroundColor: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.25)' },
  typeBadgeFixed: { backgroundColor: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.25)' },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  typeBadgeTextPercent: { color: '#2563EB' },
  typeBadgeTextFixed: { color: '#16A34A' },
  actionBtn: { padding: spacing.xs },
  cardDesc: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  cardMetaText: { ...typography.small, color: colors.textMuted },
  expiredText: { color: colors.error },
  statusBadge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },

  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', ...shadows.lg },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sheetTitle: { ...typography.h3, color: colors.textPrimary },

  detailLabel: { ...typography.label, color: colors.textMuted, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, marginTop: spacing.sm },
  infoCard: { backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  infoRowLast: { borderBottomWidth: 0 },
  infoValue: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },

  toggleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, marginTop: spacing.md },
  toggleCardLabel: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  toggleSwitch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },

  detailActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  detailEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingVertical: 12, backgroundColor: colors.background },
  detailEditBtnText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  detailDeleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.md, paddingVertical: 12, backgroundColor: 'rgba(239,68,68,0.05)' },
  detailDeleteBtnText: { ...typography.bodySmall, color: colors.error, fontWeight: '700' },

  errorBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.error },

  fieldLabel: { ...typography.small, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 11, ...typography.body, color: colors.textPrimary, backgroundColor: colors.background },
  row2: { flexDirection: 'row', gap: spacing.sm },
  typeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  typeChip: { flex: 1, paddingVertical: 11, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.background },
  typeChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(15,32,68,0.05)' },
  typeChipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  typeChipTextActive: { color: colors.primary },

  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateBtnText: { ...typography.body, color: colors.textPrimary, flex: 1 },
  dateBtnPlaceholder: { color: colors.textMuted },
  iosPickerWrap: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginTop: 4, overflow: 'hidden' },
  iosPickerDone: { alignItems: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  iosPickerDoneText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },

  saveBtn: { backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg, ...shadows.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.primary },
});
