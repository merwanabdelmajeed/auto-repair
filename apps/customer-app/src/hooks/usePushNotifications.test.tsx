import { renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { usePushNotifications } from './usePushNotifications';
import { registerPushToken } from '../api/notifications';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'proj-1' } } } }));
jest.mock('../api/notifications', () => ({ registerPushToken: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

describe('usePushNotifications', () => {
  it('registers the token when permission is already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'expo-tok-1' });
    (registerPushToken as jest.Mock).mockResolvedValue({ success: true });

    renderHook(() => usePushNotifications(true));

    await waitFor(() => expect(registerPushToken).toHaveBeenCalledWith('expo-tok-1'));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'proj-1' });
  });

  it('requests permission when not already granted, and registers on success', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'expo-tok-2' });

    renderHook(() => usePushNotifications(true));

    await waitFor(() => expect(registerPushToken).toHaveBeenCalledWith('expo-tok-2'));
  });

  it('does not register a token when permission is denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    renderHook(() => usePushNotifications(true));

    await waitFor(() => expect(Notifications.requestPermissionsAsync).toHaveBeenCalled());
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it('calls getExpoPushTokenAsync with no options when there is no EAS projectId', async () => {
    (Constants as unknown as { expoConfig: unknown }).expoConfig = { extra: {} };
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'expo-tok-3' });

    renderHook(() => usePushNotifications(true));

    await waitFor(() => expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith(undefined));
  });

  it('does nothing when disabled (guest browsing, not signed in)', async () => {
    renderHook(() => usePushNotifications(false));

    await Promise.resolve();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it('swallows errors (e.g. no FCM on an emulator) without throwing', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockRejectedValue(new Error('no FCM'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => usePushNotifications(true));

    await waitFor(() => expect(warnSpy).toHaveBeenCalled());
    warnSpy.mockRestore();
  });
});
