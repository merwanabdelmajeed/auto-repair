import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

type SettingSection = {
  title: string;
  items: SettingItem[];
};

type SettingItem =
  | { type: 'toggle'; icon: keyof typeof Ionicons.glyphMap; label: string; value: boolean }
  | { type: 'link'; icon: keyof typeof Ionicons.glyphMap; label: string; value?: string };

const SETTINGS: SettingSection[] = [
  {
    title: 'Notifications',
    items: [
      { type: 'toggle', icon: 'notifications-outline', label: 'Push Notifications', value: true },
      { type: 'toggle', icon: 'calendar-outline', label: 'Appointment Reminders', value: true },
      { type: 'toggle', icon: 'pricetag-outline', label: 'Promotion Alerts', value: false },
    ],
  },
  {
    title: 'App Preferences',
    items: [
      { type: 'link', icon: 'location-outline', label: 'Preferred Location', value: 'Not set' },
      { type: 'link', icon: 'language-outline', label: 'Language', value: 'English' },
      { type: 'toggle', icon: 'moon-outline', label: 'Dark Mode', value: false },
    ],
  },
  {
    title: 'About',
    items: [
      { type: 'link', icon: 'document-text-outline', label: 'Terms of Service' },
      { type: 'link', icon: 'shield-outline', label: 'Privacy Policy' },
      { type: 'link', icon: 'help-circle-outline', label: 'Help & Support' },
      { type: 'link', icon: 'information-circle-outline', label: 'App Version', value: '1.0.0 (Phase 0)' },
    ],
  },
];

export default function SettingsScreen() {
  return (
    <Layout>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {SETTINGS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <View
                  key={item.label}
                  style={[
                    styles.row,
                    i === section.items.length - 1 && styles.rowLast,
                  ]}
                >
                  <View style={styles.rowIcon}>
                    <Ionicons name={item.icon} size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.type === 'toggle' ? (
                    <Switch
                      value={item.value}
                      thumbColor={item.value ? colors.white : colors.white}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      onValueChange={() => {}}
                    />
                  ) : (
                    <View style={styles.rowRight}>
                      {item.value ? (
                        <Text style={styles.rowValue}>{item.value}</Text>
                      ) : null}
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: spacing.xxl },

  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    ...shadows.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowValue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
