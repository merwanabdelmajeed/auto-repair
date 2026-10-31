import React from 'react';
import { TouchableOpacity, StyleSheet, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

// Small icon button that calls a customer's phone number, after confirming —
// so a stray tap never dials anyone.
export default function CallButton({ phone, name }: { phone: string; name?: string }) {
  function confirmCall() {
    Alert.alert(name ? `Call ${name}?` : 'Call this number?', phone, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () => {
          // Numbers are stored formatted, e.g. "(949) 555-1234" — dial digits only.
          Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() =>
            Alert.alert('Unable to call', 'This device cannot place phone calls.'),
          );
        },
      },
    ]);
  }

  return (
    <TouchableOpacity
      testID="call-btn"
      accessibilityRole="button"
      accessibilityLabel={name ? `Call ${name}` : 'Call'}
      onPress={confirmCall}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.btn}
      activeOpacity={0.6}
    >
      <Ionicons name="call" size={15} color={colors.success} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: 4 },
});
