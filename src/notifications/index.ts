// Local notifications, wired to the device and the app's store. Tests build the pieces
// (schedule, sync) with fakes instead.
import * as Notifications from 'expo-notifications';

import { appStore } from '@/store';

import { ensureReminderChannel, getReminderPermission } from './permissions';
import { createReminderSync, startReminderSync, syncInputFrom } from './sync';

const reminders = createReminderSync({
  api: Notifications,
  read: () => syncInputFrom(appStore.getState()),
  allowed: async () => (await getReminderPermission()) === 'granted',
  prepare: ensureReminderChannel,
  onError: (error) => {
    if (__DEV__) console.warn('Reminder sync failed:', error);
  },
});

/** Reschedule now, e.g. right after the user turns reminders on. */
export const requestSync = reminders.sync;
export const onSynced = reminders.subscribe;

/** Keep scheduled reminders in step with the goal from launch on. Returns a cleanup. */
export function startNotifications(): () => void {
  return startReminderSync(appStore, reminders);
}
