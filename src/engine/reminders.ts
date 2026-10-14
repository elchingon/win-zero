// Which local notifications to have scheduled (SPEC 2). Pure: the notifications layer cancels
// everything and schedules this list on every check-in and app open.
import { addDays } from './dates';
import { MISSES_UNTIL_RESET } from './rules';
import type { DayKey, GoalState } from './types';
import { firstUnsettledDay, opensAt, windowFor } from './windows';

/** Windows to schedule ahead. */
export const REMINDER_HORIZON_DAYS = 7;
export const REENGAGE_EVERY_DAYS = 7;
/** Weekly nudges to schedule ahead after a reset. More are added whenever the app opens. */
export const REENGAGE_NUDGE_COUNT = 8;

export type ReminderKind = 'checkin' | 'morning' | 'reengage';

export interface PlannedReminder {
  at: Date;
  kind: ReminderKind;
  /** The goal day whose window is open at `at`. */
  day: DayKey;
}

export interface ReminderOptions {
  /** The weekly re-engagement setting (default on). */
  reengage: boolean;
}

/**
 * Reminders after `now`, assuming nothing else gets answered. Expects a state resolved at `now`.
 * - Each window that could still be missed before the 7-day reset gets its evening check-in
 *   and its morning reminder. Nothing is sent for the window that opens as the reset happens.
 * - Weekly nudges start one week after the reset, whether it already happened or is projected.
 */
export function planReminders(state: GoalState, now: Date, options: ReminderOptions): PlannedReminder[] {
  const t = now.getTime();
  const out: PlannedReminder[] = [];
  const first = firstUnsettledDay(state);
  const missed = state.consecutiveMissed;

  const windows = Math.min(REMINDER_HORIZON_DAYS, Math.max(0, MISSES_UNTIL_RESET - missed));
  for (let i = 0; i < windows; i++) {
    const w = windowFor(state, addDays(first, i));
    if (w.opensAt.getTime() > t) out.push({ at: w.opensAt, kind: 'checkin', day: w.day });
    if (w.remindAt && w.remindAt.getTime() > t) out.push({ at: w.remindAt, kind: 'morning', day: w.day });
  }

  if (options.reengage) {
    // The 7th miss in a row, past or projected. The reset lands when its window closes,
    // which is when the following day's window opens.
    const resetDay = addDays(first, MISSES_UNTIL_RESET - 1 - missed);
    for (let k = 1, added = 0; added < REENGAGE_NUDGE_COUNT; k++) {
      const day = addDays(resetDay, 1 + REENGAGE_EVERY_DAYS * k);
      const at = opensAt(state, day);
      if (at.getTime() > t) {
        out.push({ at, kind: 'reengage', day });
        added++;
      }
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
