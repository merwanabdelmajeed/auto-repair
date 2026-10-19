import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme';
import { addVehicleForCustomer, type Vehicle } from '../api/vehicles';
import { decodeVin, normalizeVin, VIN_LENGTH } from '../utils/vin';
import { missingFieldsMessage } from '../utils/missingFields';

// Admin adds a vehicle for a customer. A 17-character VIN is required; it's
// decoded via NHTSA's free decoder to pre-fill year/make/model/trim, but every
// field stays editable so the admin can enter or correct details by hand
// (e.g. when a VIN doesn't decode). The paid plate lookup is deliberately not
// offered here (customer app only).

const CUR_YEAR = new Date().getFullYear();

type Props = {
  customerId: string;
  onAdded: (vehicle: Vehicle) => void;
  onCancel: () => void;
  // Pre-fills (and immediately decodes) the VIN — used when an edited VIN
  // turned out to belong to a different car.
  initialVin?: string;
};

export default function AddVehicleForm({ customerId, onAdded, onCancel, initialVin }: Props) {
  const [vin, setVin] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [vinError, setVinError] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [trim, setTrim] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialVin) void handleVinChange(initialVin);
    // Run once on open; later VIN edits go through the input's onChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVinChange(raw: string) {
    const next = normalizeVin(raw);
    setVin(next);
    setVinError('');
    setDecoded(false);
    if (next.length !== VIN_LENGTH) return;
    setDecoding(true);
    const result = await decodeVin(next);
    setDecoding(false);
    if (result.status !== 'ok') {
      setVinError(result.status === 'unavailable'
        ? 'VIN lookup is unavailable right now — enter the details manually.'
        : "Couldn't decode this VIN — check it or enter the details manually.");
      return;
    }
    const v = result.vehicle;
    setYear(v.year);
    setMake(v.make);
    setModel(v.model);
    setTrim(v.trim ?? '');
    setDecoded(true);
  }

  async function handleSave() {
    if (vin.length !== VIN_LENGTH) {
      setError('VIN must be 17 characters.');
      return;
    }
    const missing = missingFieldsMessage({ Year: year, Make: make, Model: model, Color: color });
    if (missing) {
      setError(missing);
      return;
    }
    const y = parseInt(year, 10);
    if (isNaN(y) || y < 1900 || y > CUR_YEAR + 1) {
      setError('Please enter a valid year.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const vehicle = await addVehicleForCustomer({
        customerId,
        vin,
        year: y,
        make: make.trim(),
        model: model.trim(),
        trim: trim.trim() || undefined,
        color: color.trim(),
        licensePlate: plate.trim().toUpperCase() || undefined,
      });
      onAdded(vehicle);
    } catch {
      setError('Failed to add vehicle. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, opts: { placeholder?: string; numeric?: boolean; caps?: boolean } = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={set}
        placeholder={opts.placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={opts.numeric ? 'number-pad' : 'default'}
        autoCapitalize={opts.caps ? 'characters' : 'words'}
      />
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.label}>VIN</Text>
      <TextInput
        accessibilityLabel="VIN"
        style={[styles.input, styles.vinInput]}
        value={vin}
        onChangeText={t => void handleVinChange(t)}
        placeholder="17-character VIN"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
      />
      <View style={styles.vinStatus}>
        {decoding ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <Text style={[styles.hint, !!vinError && styles.errorText]}>
          {decoding ? 'Decoding VIN…' : vinError || (decoded ? 'VIN decoded — check the details below.' : `${vin.length}/${VIN_LENGTH} characters`)}
        </Text>
      </View>

      <View style={styles.row}>
        {field('Year', year, setYear, { placeholder: 'e.g. 2020', numeric: true })}
        {field('Make', make, setMake, { placeholder: 'e.g. Honda' })}
      </View>
      <View style={styles.row}>
        {field('Model', model, setModel, { placeholder: 'e.g. Accord' })}
        {field('Trim', trim, setTrim, { placeholder: 'Optional' })}
      </View>
      <View style={styles.row}>
        {field('Color', color, setColor, { placeholder: 'e.g. Silver' })}
        {field('License plate', plate, setPlate, { placeholder: 'Optional', caps: true })}
      </View>

      {error ? <Text style={[styles.hint, styles.errorText]}>{error}</Text> : null}

      <View style={styles.actions}>
        <TouchableOpacity testID="add-vehicle-cancel" onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="add-vehicle-save"
          style={[styles.saveBtn, (saving || decoding) && styles.saveBtnDisabled]}
          onPress={() => void handleSave()}
          disabled={saving || decoding}
        >
          {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>Add vehicle</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1 },
  label: { ...typography.label, color: colors.textMuted, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4, marginTop: 4 },
  input: {
    ...typography.bodySmall, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 8, backgroundColor: colors.surface,
  },
  vinInput: { fontFamily: 'monospace', letterSpacing: 0.5 },
  vinStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  hint: { ...typography.bodySmall, color: colors.textMuted, fontSize: 12 },
  errorText: { color: colors.error },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  cancelText: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '600' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 8, paddingHorizontal: spacing.md },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { ...typography.bodySmall, color: colors.white, fontWeight: '700' },
});
