import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  listServices, createService, updateService, deleteService,
  type Service, type ServiceInput,
} from '../api/services';

const EMPTY_FORM: ServiceInput = { name: '', description: '', durationMinutes: 30, price: undefined, isActive: true };

export default function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setServices(await listServices());
    } catch {
      Alert.alert('Error', 'Failed to load services.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(svc: Service) {
    setEditing(svc);
    setForm({ name: svc.name, description: svc.description, durationMinutes: svc.durationMinutes, price: svc.price, isActive: svc.isActive });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Service name is required.'); return; }
    if (form.durationMinutes <= 0) { setFormError('Duration must be greater than 0.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateService(editing.serviceId, form);
        setServices(prev => prev.map(s => s.serviceId === editing.serviceId ? { ...s, ...form } : s));
      } else {
        const created = await createService(form);
        setServices(prev => [created, ...prev]);
      }
      setShowModal(false);
    } catch {
      setFormError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(svc: Service) {
    Alert.alert('Delete Service', `Delete "${svc.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteService(svc.serviceId);
            setServices(prev => prev.filter(s => s.serviceId !== svc.serviceId));
          } catch {
            Alert.alert('Error', 'Failed to delete service.');
          }
        },
      },
    ]);
  }

  return (
    <Layout>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {services.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="construct-outline" size={48} color={colors.textMuted} /></View>
              <Text style={styles.emptyTitle}>No Services Yet</Text>
              <Text style={styles.emptyDesc}>Add your first service to make it available for customer bookings.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd} activeOpacity={0.85}>
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={styles.emptyBtnText}>Add Service</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Services ({services.length})</Text>
              {services.map(svc => (
                <TouchableOpacity key={svc.serviceId} style={styles.card} onPress={() => openEdit(svc)} activeOpacity={0.8}>
                  <View style={styles.cardLeft}>
                    <View style={styles.cardIcon}>
                      <Ionicons name="construct-outline" size={22} color={colors.secondary} />
                    </View>
                    <View style={styles.cardInfo}>
                      <View style={styles.cardNameRow}>
                        <Text style={styles.cardName}>{svc.name}</Text>
                        <View style={[styles.badge, svc.isActive ? styles.badgeActive : styles.badgeInactive]}>
                          <Text style={[styles.badgeText, svc.isActive ? styles.badgeTextActive : styles.badgeTextInactive]}>
                            {svc.isActive ? 'Active' : 'Inactive'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.cardMeta}>{svc.durationMinutes} min{svc.price != null ? `  ·  $${svc.price.toFixed(2)}` : ''}</Text>
                      {svc.description ? <Text style={styles.cardDesc} numberOfLines={1}>{svc.description}</Text> : null}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => confirmDelete(svc)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {!loading && (
        <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color={colors.white} />
        </TouchableOpacity>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editing ? 'Edit Service' : 'Add Service'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {formError ? (
                <View style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View>
              ) : null}

              <Text style={styles.fieldLabel}>Service Name *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Oil Change" placeholderTextColor={colors.textMuted} />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput style={[styles.input, { height: 72, textAlignVertical: 'top' }]} value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="Optional description…" placeholderTextColor={colors.textMuted} multiline />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Duration (min) *</Text>
                  <TextInput style={styles.input} value={String(form.durationMinutes)} onChangeText={v => setForm(p => ({ ...p, durationMinutes: parseInt(v) || 0 }))} keyboardType="number-pad" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Price ($)</Text>
                  <TextInput style={styles.input} value={form.price != null ? String(form.price) : ''} onChangeText={v => setForm(p => ({ ...p, price: v === '' ? undefined : parseFloat(v) || 0 }))} keyboardType="decimal-pad" placeholder="e.g. 49.99" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Active (visible to customers)</Text>
                <Switch value={form.isActive} onValueChange={v => setForm(p => ({ ...p, isActive: v }))} trackColor={{ false: colors.border, true: colors.primary }} thumbColor={colors.white} />
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={() => void handleSave()} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Add Service'}</Text>}
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

  emptyState: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, ...shadows.sm },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 12, paddingHorizontal: spacing.lg },
  emptyBtnText: { ...typography.h4, color: colors.primary },

  sectionTitle: { ...typography.h4, color: colors.textPrimary, paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },

  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: 'rgba(245,158,11,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  cardInfo: { flex: 1 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginBottom: 2 },
  cardName: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '700' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  badgeActive: { backgroundColor: 'rgba(34,197,94,0.12)' },
  badgeInactive: { backgroundColor: 'rgba(148,163,184,0.15)' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextActive: { color: '#16A34A' },
  badgeTextInactive: { color: colors.textMuted },
  cardMeta: { ...typography.small, color: colors.secondary, fontWeight: '600' },
  cardDesc: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  actionBtn: { padding: spacing.sm },

  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', ...shadows.lg },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sheetTitle: { ...typography.h3, color: colors.textPrimary },

  errorBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.error },

  fieldLabel: { ...typography.small, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 11, ...typography.body, color: colors.textPrimary, backgroundColor: colors.background },
  row2: { flexDirection: 'row', gap: spacing.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider, marginTop: spacing.md },
  toggleLabel: { ...typography.body, color: colors.textPrimary },

  saveBtn: { backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg, ...shadows.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.primary },
});
