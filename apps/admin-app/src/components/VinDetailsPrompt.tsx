import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, type ViewStyle } from 'react-native';
import { colors, spacing, typography, borderRadius } from '../theme';
import { describeDecoded, type VinLookup } from '../hooks/useVehicleEdit';

// Live result of the VIN lookup, shown under the VIN field while editing —
// before Save. A VIN that belongs to a different car blocks the edit and
// offers to add that car as a new vehicle instead.
type Props = {
  lookup: VinLookup;
  onAddAsNew: () => void;
  style?: ViewStyle;
};

export default function VinDetailsPrompt({ lookup, onAddAsNew, style }: Props) {
  if (lookup.status === 'idle') return null;
  if (lookup.status === 'decoding') {
    return (
      <View style={[styles.row, style]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.note}>Looking up VIN…</Text>
      </View>
    );
  }
  if (lookup.status === 'match') {
    return <Text style={[styles.note, styles.match, style]}>✓ VIN matches this vehicle ({describeDecoded(lookup.decoded)}).</Text>;
  }
  if (lookup.status === 'not-found') {
    return <Text style={[styles.note, style]}>Couldn't decode this VIN — it will be saved as entered.</Text>;
  }
  if (lookup.status === 'unavailable') {
    return <Text style={[styles.note, style]}>VIN lookup is unavailable right now — it will be saved as entered.</Text>;
  }
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.text}>
        This VIN belongs to a <Text style={styles.bold}>{describeDecoded(lookup.decoded)}</Text> — a different car.
        To keep this vehicle's service history accurate, add it as a new vehicle instead.
      </Text>
      <TouchableOpacity testID="vin-add-as-new" style={styles.addBtn} onPress={onAddAsNew} activeOpacity={0.8}>
        <Text style={styles.addText}>Add as new vehicle</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  note: { ...typography.bodySmall, fontSize: 12, color: colors.textMuted },
  match: { color: colors.success },
  box: {
    backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)',
    borderRadius: borderRadius.md, padding: spacing.sm, gap: spacing.sm,
  },
  text: { ...typography.bodySmall, color: colors.textPrimary },
  bold: { fontWeight: '700' },
  addBtn: { alignSelf: 'flex-start', backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 8, paddingHorizontal: spacing.md },
  addText: { ...typography.bodySmall, color: colors.white, fontWeight: '700' },
});
