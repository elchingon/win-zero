// Which local notifications to have scheduled (SPEC 2). Pure: the notifications layer cancels
// everything and schedules this list on every check-in and app open.
import { addDays } from './dates';
import { goalDayOnOrAfter, nextGoalDay } from './goalDays';
import { applyMissed, MISSED_GRACE_DAYS, SLIDE_FINAL } from './rules';
import type { CheckInWindow, DayKey, GoalState } from './types';
import { firstUnsettledDay, opensAt, windowFor } from './windows';

/**
 * Most windows to schedule ahead: the grace days plus a full slide, which reaches the reset
 * from a fresh run. For one goal, two reminders each plus the nudges stay under iOS's 64 pending
 * notifications; several goals share that budget (planAllReminders).
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

export interface DailyPlan {
  reminders: PlannedReminder[];
  /** The goal day daily reminders end on, real or projected: weekly nudges count from it. */
  lastDay: DayKey;
}

/**
 * One goal's daily reminders after `now`, assuming nothing else gets answered. Expects a state
 * resolved at `now`.
 * - Each window gets its evening check-in and its morning reminder, up to and including the
 *   one whose miss would reset the streak (projected with the real rules, so the grace days,
 *   the slide so far, and shields all count). The next goal day's check-in still comes when it
 *   arrives before that reset lands at midnight; answering then keeps the streak. Nothing
 *   after that, nor while reminders are paused.
 * - A check-in that arrives while the goal day before is still open is marked `earlier`.
 */
export function planDaily(state: GoalState, now: Date): DailyPlan {
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
  for (let i = 0, day = first; i < REMINDER_MAX_WINDOWS && !projected.paused; i++, day = nextGoalDay(state, day)) {
    const w = windowFor(state, day);
    pushCheckIn(w, prev);
    if (w.remindAt && w.remindAt.getTime() > t) out.push({ at: w.remindAt, kind: 'morning', day: w.day });
    projected = applyMissed(projected, { day: w.day, at: w.closesAt, tz: w.tz }).state;
    lastDaily = w.day;
    prev = w;
  }
  // The goal day after the reset day may open before the reset lands: then its check-in is the last one.
  if (projected.paused && !state.paused && prev) {
    const w = windowFor(state, nextGoalDay(state, prev.day));
    if (w.opensAt.getTime() < prev.closesAt.getTime()) pushCheckIn(w, prev);
  }
  const lastDay = (state.paused ? pausedOnDay(state) : lastDaily) ?? addDays(first, -1);
  return { reminders: out, lastDay };
}

/**
 * Weekly nudges after `now`, starting one week after `lastDay` (planDaily): after the reset,
 * whether it already happened or is projected. If shields push it past REMINDER_MAX_WINDOWS,
 * a week after the last daily window. The reset lands when its window closes, at midnight at the
 * end of the following day; nudges come at check-in time, a week at a time from that following
 * day, on a goal day.
 */
export function planNudges(state: GoalState, now: Date, lastDay: DayKey): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (let k = 1; out.length < REENGAGE_NUDGE_COUNT; k++) {
    const day = goalDayOnOrAfter(state, addDays(lastDay, 1 + REENGAGE_EVERY_DAYS * k));
    const at = opensAt(state, day);
    if (at.getTime() > now.getTime()) out.push({ at, kind: 'reengage', day });
  }
  return out;
}

/** One goal's reminders after `now`: its daily ones, then weekly nudges. Expects a state resolved at `now`. */
export function planReminders(state: GoalState, now: Date, options: ReminderOptions): PlannedReminder[] {
  const daily = planDaily(state, now);
  const out = options.reengage ? [...daily.reminders, ...planNudges(state, now, daily.lastDay)] : daily.reminders;
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Windows each goal keeps first when the budget runs short. */
export const REMINDER_NEAR_WINDOWS = 2;
/** Weekly nudges kept ahead of the goals' later daily reminders. */
export const REENGAGE_NUDGES_KEPT = 1;

export interface GoalReminder extends PlannedReminder {
  goalId: string;
}

/**
 * Reminders for every goal (SPEC 9), at most `budget` of them (iOS keeps 64 pending per app).
 * - Each goal has its own daily reminders (planDaily).
 * - Weekly nudges are one stream that never names a goal: the stream of the goal whose daily
 *   reminders end last, so nobody is nudged while another goal still asks every day.
 * - When they don't all fit, they're kept in this order: each goal's next REMINDER_NEAR_WINDOWS
 *   windows, the first REENGAGE_NUDGES_KEPT nudges, the other daily reminders earliest first,
 *   then the other nudges. Reminders come back as the app opens and reschedules.
 * With one goal everything fits, and the plan is planReminders's. Expects goals resolved at `now`.
 */
export function planAllReminders(
  goals: readonly GoalState[],
  now: Date,
  options: ReminderOptions & { budget: number },
): GoalReminder[] {
  const ranked: { reminder: GoalReminder; tier: number; order: number }[] = [];
  const starts = (nudges: PlannedReminder[]) => nudges[0]?.at.getTime() ?? -Infinity;
  let stream: { order: number; goalId: string; nudges: PlannedReminder[] } | null = null;
  for (const [order, goal] of goals.entries()) {
    const daily = planDaily(goal, now);
    const near = new Set<DayKey>();
    for (const r of daily.reminders) {
      if (near.size < REMINDER_NEAR_WINDOWS) near.add(r.day);
      ranked.push({ reminder: { ...r, goalId: goal.goalId }, tier: near.has(r.day) ? 0 : 2, order });
    }
    if (!options.reengage) continue;
    const nudges = planNudges(goal, now, daily.lastDay);
    if (!stream || starts(nudges) > starts(stream.nudges)) stream = { order, goalId: goal.goalId, nudges };
  }
  if (stream) {
    const { order, goalId, nudges } = stream;
    nudges.forEach((r, i) => ranked.push({ reminder: { ...r, goalId }, tier: i < REENGAGE_NUDGES_KEPT ? 1 : 3, order }));
  }
  return ranked
    .sort((a, b) => a.tier - b.tier || a.reminder.at.getTime() - b.reminder.at.getTime() || a.order - b.order)
    .slice(0, Math.max(0, options.budget))
    .map((x) => x.reminder)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
