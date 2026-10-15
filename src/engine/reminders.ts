// Which local notifications to have scheduled (SPEC 2). Pure: the notifications layer cancels
// everything and schedules this list on every check-in and app open.
import { addDays } from './dates';
import { applyMissed, MISSED_GRACE_DAYS, SLIDE_FINAL } from './rules';
import type { CheckInWindow, DayKey, GoalState } from './types';
import { firstUnsettledDay, opensAt, windowFor } from './windows';

/**
 * Most windows to schedule ahead: the grace days plus a full slide, which reaches the reset
 * from a fresh run. Two reminders each plus the nudges stay under iOS's 64 pending notifications.
 */
export const REMINDER_MAX_WINDOWS = MISSED_GRACE_DAYS + SLIDE_FINAL;
export const REENGAGE_EVERY_DAYS = 7;
/** Weekly nudges to schedule ahead after a reset. More are added whenever the app opens. */
export const REENGAGE_NUDGE_COUNT = 8;

export type ReminderKind = 'checkin' | 'morning' | 'reengage';

export interface PlannedReminder {
  at: Date;
  kind: ReminderKind;
  /** The goal day whose window is open at `at`. */
  day: DayKey;
  /**
   * A check-in that arrives while an earlier day is still open. Home asks about that day first,
   * so this one shouldn't answer for its own day.
   */
  earlier?: DayKey;
}

export interface ReminderOptions {
  /** The weekly re-engagement setting (default on). */
  reengage: boolean;
}

/** The day whose miss reset the streak and paused reminders, in the current run of misses. */
function pausedOnDay(state: GoalState): DayKey | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const e = state.history[i];
    if (e?.reset && e.missedInRow !== undefined) return e.day;
  }
  return null;
}

/**
 * Reminders after `now`, assuming nothing else gets answered. Expects a state resolved at `now`.
 * - Each window gets its evening check-in and its morning reminder, up to and including the
 *   one whose miss would reset the streak (projected with the real rules, so the grace days,
 *   the slide so far, and shields all count). The next day's check-in still comes, as it
 *   arrives before that reset lands at midnight; answering then keeps the streak. Nothing
 *   after that, nor while reminders are paused.
 * - A check-in that arrives while the day before is still open is marked `earlier`.
 * - Weekly nudges start one week after that reset, whether it already happened or is projected.
 *   If shields push it past REMINDER_MAX_WINDOWS, they start a week after the last daily window.
 */
export function planReminders(state: GoalState, now: Date, options: ReminderOptions): PlannedReminder[] {
  const t = now.getTime();
  const out: PlannedReminder[] = [];
  const first = firstUnsettledDay(state);

  const pushCheckIn = (w: CheckInWindow, prev: CheckInWindow | null) => {
    if (w.opensAt.getTime() <= t) return;
    const checkIn: PlannedReminder = { at: w.opensAt, kind: 'checkin', day: w.day };
    if (prev && prev.closesAt.getTime() > w.opensAt.getTime()) checkIn.earlier = prev.day;
    out.push(checkIn);
  };

  let lastDaily: DayKey | null = null;
  let prev: CheckInWindow | null = null;
  let projected = state;
  for (let i = 0; i < REMINDER_MAX_WINDOWS && !projected.paused; i++) {
    const w = windowFor(state, addDays(first, i));
    pushCheckIn(w, prev);
    if (w.remindAt && w.remindAt.getTime() > t) out.push({ at: w.remindAt, kind: 'morning', day: w.day });
    projected = applyMissed(projected, { day: w.day, at: w.closesAt, tz: w.tz }).state;
    lastDaily = w.day;
    prev = w;
  }
  // The day after the reset day opens before the reset lands: its check-in is the last one.
  if (projected.paused && !state.paused && prev) {
    const w = windowFor(state, addDays(prev.day, 1));
    if (w.opensAt.getTime() < prev.closesAt.getTime()) pushCheckIn(w, prev);
  }

  if (options.reengage) {
    // The reset lands when its window closes, at midnight at the end of the following day.
    // Nudges come at check-in time, a week at a time from that following day.
    const lastDay = (state.paused ? pausedOnDay(state) : lastDaily) ?? addDays(first, -1);
    for (let k = 1, added = 0; added < REENGAGE_NUDGE_COUNT; k++) {
      const day = addDays(lastDay, 1 + REENGAGE_EVERY_DAYS * k);
      const at = opensAt(state, day);
      if (at.getTime() > t) {
        out.push({ at, kind: 'reengage', day });
        added++;
      }
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
