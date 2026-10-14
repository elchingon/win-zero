// Notification permission and the Android channel reminders are posted to.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { colors } from '@/theme/tokens';

import { CHECKIN_CHANNEL_ID } from './shared';

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

function summarize(s: Notifications.NotificationPermissionsStatus): ReminderPermission {
  const provisional = s.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (s.granted || provisional) return 'granted';
  return s.status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * The Android channel for check-ins and reminders. Android 13+ shows no permission prompt until
 * the app has one, and reminders are scheduled onto it. Safe to call again.
 */
export async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHECKIN_CHANNEL_ID, {
    name: 'Check-ins',
    description: 'Your daily check-in and the next-morning reminder.',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.amber,
  });
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  try {
    return summarize(await Notifications.getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

/** Ask once. If the OS won't ask again, report 'denied' so the UI can point to Settings. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  try {
    await ensureReminderChannel();
    const current = await Notifications.getPermissionsAsync();
    if (summarize(current) === 'granted') return 'granted';
    if (!current.canAskAgain) return 'denied';
    return summarize(
      await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }),
    );
  } catch {
    return 'undetermined';
  }
}
