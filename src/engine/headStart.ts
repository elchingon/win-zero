// Head start (SPEC 9): a goal set up in Win Zero Plus can count days already done before it, up to
// HEAD_START_MAX. They're recorded at setup as Yeses on the check-in days just before today,
// through the same rule as any Yes, so the streak, best run, bombs and shields come out as a real
// run that long would. Each is marked `headStart`, so what counts check-ins (Yeses in a row, the
// first day's tip) can leave them out. Today is never one: its check-in works as for any new goal.
import { addDays, weekdayOf } from './dates';
import { checkInDays, firstGoalDay, nextGoalDay } from './goalDays';
import { createGoal, type CreateGoalInput } from './resolve';
import { applyYes } from './rules';
import type { DayKey, GoalState, HistoryEntry } from './types';
import { newlyUnlocked, type WeaponDef } from './weapons';
import { opensAt } from './windows';

/** The most days a head start can count. */
export const HEAD_START_MAX = 30;

export interface HeadStartInput extends CreateGoalInput {
  /** Days already done before the goal was set up, from 0 to HEAD_START_MAX. None when absent. */
  headStart?: number;
}

export function isHeadStart(entry: HistoryEntry): boolean {
  return entry.headStart === true;
}

/** True while the goal's history is only its head start, or empty: nothing has settled since setup. */
export function onlyHeadStart(goal: GoalState): boolean {
  return goal.history.every(isHeadStart);
}

/** The `n` check-in days just before `day`, oldest first, on the weekdays `goal` checks in on. */
function daysBefore(goal: GoalState, day: DayKey, n: number): DayKey[] {
  const on = checkInDays(goal);
  const days: DayKey[] = [];
  for (let d = addDays(day, -1); days.length < n; d = addDays(d, -1)) {
    if (on.some((w) => w === weekdayOf(d))) days.unshift(d);
  }
  return days;
}

/**
 * A new goal (resolve.ts createGoal) with `headStart` Yeses already on it. The goal's first day,
 * and its schedule's, move back to the first of them; the last settles the day before the first
 * check-in. Throws for a head start that isn't a whole number from 0 to HEAD_START_MAX.
 */
export function createGoalWithHeadStart(input: HeadStartInput): GoalState {
  const n = input.headStart ?? 0;
  if (!Number.isInteger(n) || n < 0 || n > HEAD_START_MAX) {
    throw new RangeError(`A head start is a whole number of days from 0 to ${HEAD_START_MAX}, got ${n}`);
  }
  const goal = createGoal(input);
  const days = daysBefore(goal, goal.firstDay, n);
  const firstDay = days[0];
  if (firstDay === undefined) return goal;
  let s: GoalState = {
    ...goal,
    firstDay,
    checkInSchedule: goal.checkInSchedule.map((e, i) => (i === 0 ? { ...e, fromDay: firstDay } : e)),
  };
  for (const day of days) {
    const { state } = applyYes(s, { day, at: input.now, tz: input.tz });
    const entry = state.history[state.history.length - 1];
    s = entry ? { ...state, history: [...s.history, { ...entry, headStart: true }] } : state;
  }
  return s;
}

/** The goal's first check-in after setup: its first check-in day, or the one after its head start. */
export function firstCheckInDay(goal: GoalState): DayKey {
  let last: DayKey | null = null;
  for (const e of goal.history) if (isHeadStart(e)) last = e.day;
  return last === null ? firstGoalDay(goal) : nextGoalDay(goal, last);
}

/**
 * True when `day` is the goal's first check-in, it was already open when the goal was set up, and
 * nothing has settled since: Home says today counts (SPEC 6).
 */
export function isFirstCheckIn(goal: GoalState, day: DayKey): boolean {
  return (
    onlyHeadStart(goal) &&
    day === firstCheckInDay(goal) &&
    opensAt(goal, day).getTime() <= Date.parse(goal.createdAt)
  );
}

export interface HeadStartPreview {
  zeros: number;
  bombs: number;
  shields: number;
  /** Weapons the head start opens beyond the shared arsenal's reach (weapons.ts arsenalReach). */
  weapons: WeaponDef[];
  /** Zeros in the round the first Yes plays. */
  firstRound: number;
}

/** What a goal made by createGoalWithHeadStart starts with, for the setup field's preview line. */
export function headStartPreview(goal: GoalState, reach: number): HeadStartPreview {
  return {
    zeros: goal.streak,
    bombs: goal.bombs,
    shields: goal.shields,
    weapons: newlyUnlocked(reach, Math.max(reach, goal.bestStreak)),
    firstRound: goal.streak + 1,
  };
}
