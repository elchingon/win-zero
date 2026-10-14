// Ids and the payload every Win Zero notification carries, shared by scheduling, responses
// and the foreground handler.
import { isValidDayKey, type DayKey, type ReminderKind } from '@/engine';

/** Android channel for check-ins and reminders. */
export const CHECKIN_CHANNEL_ID = 'checkin';
/** Notification category with the Yes / Not today buttons (SPEC 1). */
export const CHECKIN_CATEGORY_ID = 'checkin';
export const ACTION_YES = 'yes';
export const ACTION_NOT_TODAY = 'not-today';

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
