import React, { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme';

// Small icon button that copies `value` (e.g. a customer's phone number, to
// paste into the dialer). Shows a checkmark briefly to confirm the copy.
export default function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function copy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <TouchableOpacity
      testID="copy-btn"
      accessibilityRole="button"
      accessibilityLabel={copied ? 'Copied' : label}
      onPress={() => void copy()}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.btn}
      activeOpacity={0.6}
    >
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? colors.success : colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 4 },
});
