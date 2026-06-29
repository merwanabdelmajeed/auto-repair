import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  listCampaigns, createCampaign, sendCampaign,
  type Campaign, type CampaignInput,
} from '../api/campaigns';

const AUDIENCE_LABELS: Record<Campaign['targetAudience'], string> = {
  all: 'All Customers',
  inactive_30: 'Inactive 30+ days',
  inactive_60: 'Inactive 60+ days',
  inactive_90: 'Inactive 90+ days',
};

const EMPTY_FORM: CampaignInput = {
  name: '', subject: '', body: '', targetAudience: 'all',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CampaignsScreen() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CampaignInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setCampaigns(await listCampaigns());
    } catch {
      Alert.alert('Error', 'Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Campaign name is required.'); return; }
    if (!form.subject.trim()) { setFormError('Email subject is required.'); return; }
    if (!form.body.trim()) { setFormError('Email body is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const created = await createCampaign(form);
      setCampaigns(prev => [created, ...prev]);
      setShowModal(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function confirmSend(c: Campaign) {
    Alert.alert(
      'Send Campaign',
      `Send "${c.name}" to ${AUDIENCE_LABELS[c.targetAudience]}? This will send emails immediately and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Now', style: 'default',
          onPress: async () => {
            setSending(c.campaignId);
            try {
              const result = await sendCampaign(c.campaignId);
              setCampaigns(prev => prev.map(x => x.campaignId === c.campaignId
                ? { ...x, status: 'sent', sentAt: new Date().toISOString(), recipientCount: result.sent }
                : x
              ));
              Alert.alert('Sent!', `Campaign delivered to ${result.sent} recipient${result.sent !== 1 ? 's' : ''}.`);
            } catch (err: unknown) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send campaign.');
            } finally {
              setSending(null);
            }
          },
        },
      ]
    );
  }

  const drafts = campaigns.filter(c => c.status === 'draft');
  const sent = campaigns.filter(c => c.status === 'sent');

  return (
    <Layout>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {campaigns.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="megaphone-outline" size={48} color={colors.textMuted} /></View>
              <Text style={styles.emptyTitle}>No Campaigns Yet</Text>
              <Text style={styles.emptyDesc}>
                Create email campaigns to re-engage inactive customers and promote your services.
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd} activeOpacity={0.85}>
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={styles.emptyBtnText}>Create Campaign</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {drafts.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Drafts ({drafts.length})</Text>
                  {drafts.map(c => (
                    <View key={c.campaignId} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <Text style={styles.cardName}>{c.name}</Text>
                          <Text style={styles.cardAudience}>{AUDIENCE_LABELS[c.targetAudience]}</Text>
                        </View>
                        <View style={styles.draftBadge}>
                          <Text style={styles.draftBadgeText}>DRAFT</Text>
                        </View>
                      </View>
                      <Text style={styles.cardSubject} numberOfLines={1}>{c.subject}</Text>
                      <Text style={styles.cardBody} numberOfLines={2}>{c.body}</Text>
                      <TouchableOpacity
                        style={[styles.sendBtn, sending === c.campaignId && styles.sendBtnDisabled]}
                        onPress={() => confirmSend(c)}
                        disabled={sending === c.campaignId}
                        activeOpacity={0.85}
                      >
                        {sending === c.campaignId ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <>
                            <Ionicons name="send" size={14} color={colors.white} />
                            <Text style={styles.sendBtnText}>Send Campaign</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {sent.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Sent ({sent.length})</Text>
                  {sent.map(c => (
                    <View key={c.campaignId} style={[styles.card, styles.cardSent]}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <Text style={styles.cardName}>{c.name}</Text>
                          <Text style={styles.cardAudience}>{AUDIENCE_LABELS[c.targetAudience]}</Text>
                        </View>
                        <View style={styles.sentBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                          <Text style={styles.sentBadgeText}>SENT</Text>
                        </View>
                      </View>
                      <Text style={styles.cardSubject} numberOfLines={1}>{c.subject}</Text>
                      <View style={styles.sentMeta}>
                        {c.sentAt && <Text style={styles.sentMetaText}>Sent {fmtDate(c.sentAt)}</Text>}
                        {c.recipientCount !== null && (
                          <Text style={styles.sentMetaText}>{c.recipientCount} recipient{c.recipientCount !== 1 ? 's' : ''}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              )}
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
              <Text style={styles.sheetTitle}>New Campaign</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {formError ? (
                <View style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View>
              ) : null}

              <Text style={styles.fieldLabel}>Campaign Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="e.g. Summer Re-engagement"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Target Audience *</Text>
              <View style={styles.audienceGrid}>
                {(Object.entries(AUDIENCE_LABELS) as [Campaign['targetAudience'], string][]).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.audienceChip, form.targetAudience === key && styles.audienceChipActive]}
                    onPress={() => setForm(p => ({ ...p, targetAudience: key }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.audienceChipText, form.targetAudience === key && styles.audienceChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Email Subject *</Text>
              <TextInput
                style={styles.input}
                value={form.subject}
                onChangeText={v => setForm(p => ({ ...p, subject: v }))}
                placeholder="e.g. We miss you — here's 20% off"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.fieldLabel}>Email Body *</Text>
              <TextInput
                style={[styles.input, styles.bodyInput]}
                value={form.body}
                onChangeText={v => setForm(p => ({ ...p, body: v }))}
                placeholder="Write the email content here…"
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={() => void handleSave()} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.saveBtnText}>Save as Draft</Text>}
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

  card: { backgroundColor: colors.surface, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg, padding: spacing.md, ...shadows.sm },
  cardSent: { opacity: 0.85 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xs },
  cardHeaderLeft: { flex: 1, marginRight: spacing.sm },
  cardName: { ...typography.h4, color: colors.textPrimary, marginBottom: 2 },
  cardAudience: { ...typography.small, color: colors.textMuted },
  draftBadge: { backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  draftBadgeText: { fontSize: 10, fontWeight: '700', color: '#D97706' },
  sentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  sentBadgeText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  cardSubject: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600', marginBottom: spacing.xs },
  cardBody: { ...typography.small, color: colors.textSecondary, lineHeight: 18, marginBottom: spacing.md },
  sentMeta: { flexDirection: 'row', gap: spacing.md },
  sentMetaText: { ...typography.small, color: colors.textMuted },

  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.6 },
  sendBtnText: { ...typography.bodySmall, color: colors.white, fontWeight: '700' },

  fab: { position: 'absolute', right: spacing.lg, bottom: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', ...shadows.lg },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40, maxHeight: '92%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sheetTitle: { ...typography.h3, color: colors.textPrimary },

  errorBox: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.md },
  errorText: { ...typography.bodySmall, color: colors.error },

  fieldLabel: { ...typography.small, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: spacing.md },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 11, ...typography.body, color: colors.textPrimary, backgroundColor: colors.background },
  bodyInput: { height: 120, textAlignVertical: 'top' },
  audienceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  audienceChip: { paddingVertical: 9, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  audienceChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(15,32,68,0.05)' },
  audienceChipText: { ...typography.small, color: colors.textSecondary, fontWeight: '600' },
  audienceChipTextActive: { color: colors.primary },

  saveBtn: { backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.lg, ...shadows.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.primary },
});
