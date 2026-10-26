// Which calendar days are goal days: the days a goal checks in on (SPEC 9). Every day by default;
// a weekday schedule leaves the other days as rest days, with no window and no effect. Everything
// that steps from one goal day to the next (windows, catching up, reminders) goes through here,
// never addDays(day, 1).
import { addDays, diffDays, weekdayOf } from './dates';
import type { DayKey, GoalState, ScheduleEntry, Weekday } from './types';

export const EVERY_DAY: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/**
 * Check-in days as a schedule entry stores them: sorted and without repeats, and absent (undefined)
 * for every day, so a goal that checks in daily is stored exactly as before there was a choice.
 * Throws for an empty set or a day that isn't a weekday.
 */
export function normalizeDays(days: readonly number[] | undefined): Weekday[] | undefined {
  if (days === undefined) return undefined;
  const set = new Set(days);
  for (const d of set) {
    if (!Number.isInteger(d) || d < 0 || d > 6) throw new RangeError(`Not a weekday: ${d}`);
  }
  if (set.size === 0) throw new RangeError('A goal needs at least one check-in day');
  if (set.size === EVERY_DAY.length) return undefined;
  return [...set].sort((a, b) => a - b) as Weekday[];
}

/** The schedule entry in force on `day`: the last one starting on or before it. */
export function scheduleEntryFor(state: GoalState, day: DayKey): ScheduleEntry {
  const schedule = state.checkInSchedule;
  let entry = schedule[0];
  for (const e of schedule) {
    if (e.fromDay > day) break;
    entry = e;
  }
  if (!entry) throw new Error('Goal has no check-in schedule');
  return entry;
}

/** The entry that applies to future days: the current check-in time and time zone. */
export function latestScheduleEntry(state: GoalState): ScheduleEntry {
  const entry = state.checkInSchedule[state.checkInSchedule.length - 1];
  if (!entry) throw new Error('Goal has no check-in schedule');
  return entry;
}

/** True when `day` has a check-in: it's on or after the goal's first day, and one of its days. */
export function isGoalDay(state: GoalState, day: DayKey): boolean {
  if (day < state.firstDay) return false;
  const days = scheduleEntryFor(state, day).days;
  return !days || days.includes(weekdayOf(day) as Weekday);
}

/** The days upcoming check-ins fall on: every day, or the chosen weekdays. */
export function checkInDays(state: GoalState): readonly Weekday[] {
  return latestScheduleEntry(state).days ?? EVERY_DAY;
}

/** True when the goal checks in every day from now on. */
export function isEveryDay(state: GoalState): boolean {
  return !latestScheduleEntry(state).days;
}

/** The first goal day after `day`. */
export function nextGoalDay(state: GoalState, day: DayKey): DayKey {
  // Past the latest entry, a week always holds a goal day.
  const limit = Math.max(0, diffDays(latestScheduleEntry(state).fromDay, day)) + 7;
  let d = addDays(day, 1);
  for (let i = 0; i < limit; i++, d = addDays(d, 1)) {
    if (isGoalDay(state, d)) return d;
  }
  throw new Error('Goal has no check-in days');
}

/**
 * The last goal day before `day`, or null when there's none since the first day. The last settled
 * day is always a goal day, so the walk stops there: earlier days may have lost their schedule
 * entry to pruning (resolve.ts).
 */
export function prevGoalDay(state: GoalState, day: DayKey): DayKey | null {
  for (let d = addDays(day, -1); d >= state.firstDay; d = addDays(d, -1)) {
    if (d === state.lastSettledDay || isGoalDay(state, d)) return d;
  }
  return null;
}

/** `day` if it's a goal day, or else the next one. */
export function goalDayOnOrAfter(state: GoalState, day: DayKey): DayKey {
  return isGoalDay(state, day) ? day : nextGoalDay(state, day);
}

/** The goal's first check-in day. */
export function firstGoalDay(state: GoalState): DayKey {
  return goalDayOnOrAfter(state, state.firstDay);
}
