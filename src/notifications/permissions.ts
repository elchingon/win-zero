// Notification permission. Scheduling arrives in Phase 4; this only asks, and reports.
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

/** Android 13+ shows no permission prompt until the app has a notification channel. */
async function ensureChannel(): Promise<void> {
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
    await ensureChannel();
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
