// Ids, buttons and the payload every Win Zero notification carries, shared by scheduling,
// responses and the foreground handler.
import type { NotificationAction, NotificationCategoryOptions } from 'expo-notifications';

import { isValidDayKey, type DayKey, type ReminderKind } from '@/engine';

/** Android channel for check-ins and reminders. */
export const CHECKIN_CHANNEL_ID = 'checkin';
/** Notification category with the Yes / Not today buttons (SPEC 1). */
export const CHECKIN_CATEGORY_ID = 'checkin';
export const ACTION_YES = 'yes';
export const ACTION_NOT_TODAY = 'not-today';

/**
 * The check-in's buttons, the same two as Home's card. Both open the app on Home: Yes with the
 * round ready to play, Not today then its notice (answering without opening the app would need a
 * background task, which iOS doesn't run reliably for a closed app).
 */
export const CHECKIN_ACTIONS: NotificationAction[] = [
  { identifier: ACTION_YES, buttonTitle: 'Yes, I did', options: { opensAppToForeground: true } },
  { identifier: ACTION_NOT_TODAY, buttonTitle: 'Not today', options: { opensAppToForeground: true } },
];

/**
 * iOS: with previews hidden, show the (always generic) title and "Check-in" rather than the
 * system's "Notification".
 */
export const CHECKIN_CATEGORY_OPTIONS: NotificationCategoryOptions = { previewPlaceholder: 'Check-in', showTitle: true };

/** What a notification is about. `test` marks one sent from the dev tools. */
export type ReminderData = { goalId: string; day: DayKey; kind: ReminderKind; test?: true };

const KINDS: readonly ReminderKind[] = ['checkin', 'morning', 'reengage'];

/** The payload of one of our notifications, or null for anything else. */
export function readReminderData(data: unknown): ReminderData | null {
  if (typeof data !== 'object' || data === null) return null;
  const { goalId, day, kind, test } = data as Record<string, unknown>;
  if (typeof goalId !== 'string' || typeof day !== 'string' || !isValidDayKey(day)) return null;
  if (!KINDS.includes(kind as ReminderKind)) return null;
  return test === true ? { goalId, day, kind: kind as ReminderKind, test } : { goalId, day, kind: kind as ReminderKind };
}
