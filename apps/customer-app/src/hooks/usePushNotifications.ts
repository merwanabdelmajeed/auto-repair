import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from '../api/notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  useEffect(() => {
    void (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        const { status } = existing === 'granted'
          ? { status: existing }
          : await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('[Push] Permission not granted');
          return;
        }

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ??
          (Constants as Record<string, unknown>).easConfig?.projectId as string | undefined;
        console.log('[Push] projectId:', projectId);
        const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
        console.log('[Push] Token:', tokenData.data);
        await registerPushToken(tokenData.data);
        console.log('[Push] Token registered with backend');
      } catch (err) {
        // Common causes: no EAS projectId in app.json, emulator without FCM
        console.warn('[Push] Failed to register push token:', err);
      }
    })();
  }, []);
}
