// Which calendar days are goal days: the days a goal checks in on. Everything that steps from one
// goal day to the next (windows, catching up, reminders) goes through here, never addDays(day, 1).
import { addDays, diffDays } from './dates';
import type { DayKey, GoalState, ScheduleEntry } from './types';

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

/** True when `day` has a check-in: it's on or after the goal's first day. */
export function isGoalDay(state: GoalState, day: DayKey): boolean {
  return day >= state.firstDay;
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
