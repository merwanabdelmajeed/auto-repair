import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Layout from '../components/Layout';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { useNotifications } from '../contexts/NotificationsContext';
import type { AppNotification } from '../api/notifications';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_ICON: Record<string, IoniconsName> = {
  appointment_confirmed:    'checkmark-circle-outline',
  appointment_cancelled:    'close-circle-outline',
  appointment_completed:    'car-outline',
  appointment_reminder_24h: 'alarm-outline',
  appointment_reminder_2h:  'alarm-outline',
  promotion_new:            'pricetag-outline',
};

const TYPE_COLOR: Record<string, string> = {
  appointment_confirmed:    '#22c55e',
  appointment_cancelled:    '#ef4444',
  appointment_completed:    '#22c55e',
  appointment_reminder_24h: '#3b82f6',
  appointment_reminder_2h:  '#f59e0b',
  promotion_new:            colors.secondary,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotifRow({ notif, onPress }: { notif: AppNotification; onPress: () => void }) {
  const icon = TYPE_ICON[notif.type] ?? 'notifications-outline';
  const iconColor = TYPE_COLOR[notif.type] ?? colors.secondary;

  return (
    <TouchableOpacity
      style={[styles.row, !notif.read && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, !notif.read && styles.rowTitleUnread]} numberOfLines={1}>
            {notif.title}
          </Text>
          <Text style={styles.rowTime}>{timeAgo(notif.createdAt)}</Text>
        </View>
        <Text style={styles.rowBody} numberOfLines={2}>{notif.body}</Text>
      </View>
      {!notif.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { notifications, loading, markAsRead } = useNotifications();

  return (
    <Layout>
      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyContent}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-outline" size={52} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Notifications Yet</Text>
          <Text style={styles.emptyDesc}>
            You'll be notified about appointment confirmations, reminders, and new promotions.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {notifications.map((n, i) => (
            <NotifRow
              key={n.notifId}
              notif={n}
              onPress={() => { if (!n.read) void markAsRead(n.notifId); }}
            />
          ))}
        </ScrollView>
      )}
    </Layout>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  listContent: { paddingVertical: spacing.sm, paddingBottom: spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.lg, ...shadows.sm,
  },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  emptyDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  rowUnread: {
    backgroundColor: 'rgba(15,32,68,0.03)',
  },
  iconWrap: {
    width: 44, height: 44, borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md, flexShrink: 0,
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  rowTitle: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '500', flex: 1, marginRight: spacing.sm },
  rowTitleUnread: { fontWeight: '700' },
  rowTime: { ...typography.small, color: colors.textMuted, flexShrink: 0 },
  rowBody: { ...typography.small, color: colors.textSecondary, lineHeight: 17 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm, marginTop: 6, flexShrink: 0,
  },
});
