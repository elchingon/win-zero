// Local notifications, wired to the device and the app's store. Tests build the pieces
// (schedule, sync) with fakes instead.
import * as Notifications from 'expo-notifications';

import { appStore } from '@/store';

import { foregroundBehavior } from './foreground';
import { ensureReminderChannel, getReminderPermission } from './permissions';
import { startResponses } from './responses';
import { getCurrentPath, toHome } from './route';
import { CHECKIN_ACTIONS, CHECKIN_CATEGORY_ID, CHECKIN_CATEGORY_OPTIONS } from './shared';
import { createReminderSync, startReminderSync, syncInputFrom } from './sync';

/** The Android channel, and the Yes / Not today buttons, before anything is scheduled. */
async function prepare(): Promise<void> {
  await ensureReminderChannel();
  await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY_ID, CHECKIN_ACTIONS, CHECKIN_CATEGORY_OPTIONS);
}

const reminders = createReminderSync({
  api: Notifications,
  read: () => syncInputFrom(appStore.getState()),
  allowed: async () => (await getReminderPermission()) === 'granted',
  prepare,
  onError: (error) => {
    if (__DEV__) console.warn('Reminder sync failed:', error);
  },
});

/** Reschedule now, e.g. right after the user turns reminders on. */
export const requestSync = reminders.sync;
export const onSynced = reminders.subscribe;

/**
 * From launch on: keep scheduled reminders in step with the goal, answer from a notification's
 * buttons, and decide how one shows while the app is open. Start before storage is read, so a
 * response that launched the app is answered before Home first shows. Returns a cleanup.
 */
export function startNotifications(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => foregroundBehavior(getCurrentPath(), n.request.content.data),
  });
  const stopSync = startReminderSync(appStore, reminders);
  const stopResponses = startResponses(appStore, Notifications, { toHome });
  return () => {
    stopSync();
    stopResponses();
    Notifications.setNotificationHandler(null);
  };
}
