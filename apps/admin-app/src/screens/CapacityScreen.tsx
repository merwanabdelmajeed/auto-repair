import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { getCapacity, updateCapacity, type CapacitySettings, type DayName, type DayHours } from '../api/capacity';
import { listLocations, type Location } from '../api/locations';

const ALL_DAYS: DayName[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABEL: Record<DayName, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};
const SLOT_OPTIONS = [30, 45, 60, 90, 120];

function fmtSlot(min: number): string {
  return min >= 60 ? `${min / 60}h` : `${min}m`;
}

function to12h(hhmm: string): string {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return hhmm;
  const h = parseInt(m[1]!, 10);
  const min = m[2]!;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${ampm}`;
}

function formatTimeInput(text: string, prev: string): string {
  const isDeleting = text.length < prev.length;
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2 || (!isDeleting && digits.length === 2)) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  }
  return digits;
}

export default function CapacityScreen() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [settings, setSettings] = useState<CapacitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Local editable state
  const [slotDuration, setSlotDuration] = useState(30);
  const [maxConcurrent, setMaxConcurrent] = useState(2);
  const [hours, setHours] = useState<Record<DayName, DayHours | null>>({
    monday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
    tuesday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
    wednesday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
    thursday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
    friday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
    saturday: { open: '07:00', close: '17:00', lastAppointment: '17:00' },
    sunday: null,
  });

  const load = useCallback(async (locationId: string) => {
    if (!locationId) { setLoading(false); return; }
    try {
      setLoading(true);
      const data = await getCapacity(locationId);
      setSettings(data);
      setSlotDuration(data.slotDurationMinutes);
      setMaxConcurrent(data.maxConcurrent);
      setHours(data.operatingHours);
    } catch {
      Alert.alert('Error', 'Failed to load capacity settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const locs = await listLocations();
      setLocations(locs);
      setSelectedLocationId(prev => prev || (locs.find(l => l.isActive) ?? locs[0])?.locationId || '');
    } catch {
      Alert.alert('Error', 'Failed to load locations.');
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadLocations(); }, [loadLocations]));
  useFocusEffect(useCallback(() => { void load(selectedLocationId); }, [load, selectedLocationId]));

  function toggleDay(day: DayName, isOpen: boolean) {
    setHours(prev => ({
      ...prev,
      [day]: isOpen ? { open: '07:00', close: '17:00', lastAppointment: '17:00' } : null,
    }));
  }

  function updateTime(day: DayName, field: 'open' | 'close' | 'lastAppointment', text: string) {
    setHours(prev => {
      const current = prev[day];
      const prevTime = current?.[field] ?? '';
      return {
        ...prev,
        [day]: { ...current, [field]: formatTimeInput(text, prevTime) },
      };
    });
  }

  async function save() {
    // Validate times
    for (const day of ALL_DAYS) {
      const h = hours[day];
      if (h) {
        if (!/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close) || !/^\d{2}:\d{2}$/.test(h.lastAppointment ?? h.close)) {
          Alert.alert('Invalid Time', `Please enter valid times for ${DAY_LABEL[day]}.`);
          return;
        }
        if (h.open >= h.close) {
          Alert.alert('Invalid Hours', `Open time must be before close time for ${DAY_LABEL[day]}.`);
          return;
        }
        const lastAppt = h.lastAppointment ?? h.close;
        if (lastAppt < h.open || lastAppt > h.close) {
          Alert.alert('Invalid Hours', `Last appointment time must be between open and close for ${DAY_LABEL[day]}.`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const updated = await updateCapacity(selectedLocationId, { slotDurationMinutes: slotDuration, maxConcurrent, operatingHours: hours });
      setSettings(updated);
      Alert.alert('Saved', 'Capacity settings updated.');
    } catch {
      Alert.alert('Error', 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Layout>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </Layout>
    );
  }

  return (
    <Layout>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {locations.length > 0 && (
          <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
            {locations.map(loc => (
              <TouchableOpacity
                key={loc.locationId}
                style={[styles.chip, selectedLocationId === loc.locationId && styles.chipSelected]}
                onPress={() => setSelectedLocationId(loc.locationId)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, selectedLocationId === loc.locationId && styles.chipTextSelected]}>
                  {loc.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Slot Duration */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Slot Duration</Text>
          <Text style={styles.sectionDesc}>How long each appointment slot lasts.</Text>
          <View style={styles.chipRow}>
            {SLOT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, slotDuration === opt && styles.chipSelected]}
                onPress={() => setSlotDuration(opt)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, slotDuration === opt && styles.chipTextSelected]}>
                  {fmtSlot(opt)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Max Concurrent */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Max Concurrent Bookings</Text>
          <Text style={styles.sectionDesc}>Maximum appointments allowed per time slot.</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepBtn, maxConcurrent <= 1 && styles.stepBtnDisabled]}
              onPress={() => setMaxConcurrent(v => Math.max(1, v - 1))}
              disabled={maxConcurrent <= 1}
            >
              <Ionicons name="remove" size={20} color={maxConcurrent <= 1 ? colors.textMuted : colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{maxConcurrent}</Text>
            <TouchableOpacity
              style={[styles.stepBtn, maxConcurrent >= 10 && styles.stepBtnDisabled]}
              onPress={() => setMaxConcurrent(v => Math.min(10, v + 1))}
              disabled={maxConcurrent >= 10}
            >
              <Ionicons name="add" size={20} color={maxConcurrent >= 10 ? colors.textMuted : colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Operating Hours */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Operating Hours</Text>
          <Text style={styles.sectionDesc}>Set your shop's open hours for each day.</Text>
          {ALL_DAYS.map((day, i) => {
            const isOpen = hours[day] !== null;
            const h = hours[day];
            return (
              <View key={day} style={[styles.dayBlock, i < ALL_DAYS.length - 1 && styles.dayRowBorder]}>
                <View style={styles.dayRow}>
                  <View style={styles.dayLeft}>
                    <Text style={styles.dayName}>{DAY_LABEL[day]}</Text>
                  </View>
                  <Switch
                    value={isOpen}
                    onValueChange={v => toggleDay(day, v)}
                    trackColor={{ false: colors.border, true: 'rgba(15,32,68,0.35)' }}
                    thumbColor={isOpen ? colors.primary : colors.textMuted}
                  />
                  {isOpen && h ? (
                    <View style={styles.timeInputs}>
                      {editingKey === `${day}-open` ? (
                        <TextInput
                          style={styles.timeInput}
                          value={h.open}
                          onChangeText={text => updateTime(day, 'open', text)}
                          onBlur={() => setEditingKey(null)}
                          keyboardType="number-pad"
                          maxLength={5}
                          autoFocus
                          placeholderTextColor={colors.textMuted}
                        />
                      ) : (
                        <TouchableOpacity style={styles.timeDisplay} onPress={() => setEditingKey(`${day}-open`)} activeOpacity={0.7}>
                          <Text style={styles.timeDisplayText}>{to12h(h.open)}</Text>
                        </TouchableOpacity>
                      )}
                      <Text style={styles.timeSep}>–</Text>
                      {editingKey === `${day}-close` ? (
                        <TextInput
                          style={styles.timeInput}
                          value={h.close}
                          onChangeText={text => updateTime(day, 'close', text)}
                          onBlur={() => setEditingKey(null)}
                          keyboardType="number-pad"
                          maxLength={5}
                          autoFocus
                          placeholderTextColor={colors.textMuted}
                        />
                      ) : (
                        <TouchableOpacity style={styles.timeDisplay} onPress={() => setEditingKey(`${day}-close`)} activeOpacity={0.7}>
                          <Text style={styles.timeDisplayText}>{to12h(h.close)}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <Text style={styles.closedLabel}>Closed</Text>
                  )}
                </View>
                {isOpen && h ? (
                  <View style={styles.lastApptRow}>
                    <Text style={styles.lastApptLabel}>Last appointment accepted</Text>
                    {editingKey === `${day}-lastAppointment` ? (
                      <TextInput
                        style={styles.timeInput}
                        value={h.lastAppointment ?? h.close}
                        onChangeText={text => updateTime(day, 'lastAppointment', text)}
                        onBlur={() => setEditingKey(null)}
                        keyboardType="number-pad"
                        maxLength={5}
                        autoFocus
                        placeholderTextColor={colors.textMuted}
                      />
                    ) : (
                      <TouchableOpacity style={styles.timeDisplay} onPress={() => setEditingKey(`${day}-lastAppointment`)} activeOpacity={0.7}>
                        <Text style={styles.timeDisplayText}>{to12h(h.lastAppointment ?? h.close)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={() => void save()} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        {settings?.updatedAt && (
          <Text style={styles.updatedAt}>Last saved {new Date(settings.updatedAt).toLocaleString()}</Text>
        )}
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },

  card: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  sectionTitle: { ...typography.h4, color: colors.textPrimary, marginBottom: 2 },
  sectionDesc: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.md },

  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  chipSelected: { borderColor: colors.primary, backgroundColor: 'rgba(15,32,68,0.06)' },
  chipText: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: colors.primary },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  stepBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  stepBtnDisabled: { borderColor: colors.border },
  stepValue: { ...typography.h2, color: colors.textPrimary, minWidth: 32, textAlign: 'center' },

  dayBlock: { paddingVertical: 12 },
  dayRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lastApptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm, marginTop: 8 },
  lastApptLabel: { ...typography.small, color: colors.textMuted },
  dayLeft: { width: 84 },
  dayName: { ...typography.body, color: colors.textPrimary, fontWeight: '500' },
  timeInputs: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  timeInput: { borderWidth: 1, borderColor: colors.primary, borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 5, fontSize: 13, color: colors.textPrimary, width: 56, textAlign: 'center', backgroundColor: colors.background },
  timeDisplay: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, paddingHorizontal: 8, paddingVertical: 5, minWidth: 72, alignItems: 'center', backgroundColor: colors.background },
  timeDisplayText: { fontSize: 12, color: colors.textPrimary, fontWeight: '500' },
  timeSep: { color: colors.textMuted, fontSize: 14 },
  closedLabel: { flex: 1, textAlign: 'right', ...typography.small, color: colors.textMuted, fontStyle: 'italic' },

  saveBtn: { backgroundColor: colors.secondary, borderRadius: borderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm, ...shadows.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...typography.h4, color: colors.primary },
  updatedAt: { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
