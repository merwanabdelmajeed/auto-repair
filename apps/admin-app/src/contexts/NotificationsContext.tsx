import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getNotifications, markRead, type AppNotification } from '../api/notifications';

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markAsRead: (notifId: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await getNotifications();
      setNotifications(prev => {
        // Preserve any locally-marked-as-read state so polling doesn't un-read them
        const locallyRead = new Set(prev.filter(n => n.read).map(n => n.notifId));
        return fresh.map(n => ({ ...n, read: n.read || locallyRead.has(n.notifId) }));
      });
    } catch {
      // silently fail — notifications are not critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    // Poll every 30 seconds while the app is running
    const interval = setInterval(() => void refresh(), 30_000);

    // Refresh immediately when the app returns to the foreground
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);

  const markAsRead = useCallback(async (notifId: string) => {
    await markRead(notifId).catch(() => {});
    setNotifications(prev =>
      prev.map(n => n.notifId === notifId ? { ...n, read: true } : n)
    );
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, loading, refresh, markAsRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
