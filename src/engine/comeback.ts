// Comebacks (SPEC 9): a Yes after a run of check-ins without one, which Win Zero Plus welcomes back
// with its own words, a free win-back round and, after a reset, the Phoenix theme. Read from
// history only, so no rule changes and the same history always tells the same story. Apart from
// the comeback Weapon credit (creditRewards.ts), which pays once for any Yes after a missed day.
import { BONUS_MAX_N } from './credits';
import { isHeadStart } from './headStart';
import type { DayKey, GoalState } from './types';

/** A Yes after at least this many check-in days without one (missed, Not today or shielded) is a comeback. */
export const COMEBACK_MIN_GAP = 3;
/** The fewest zeros a win-back round has. */
export const WIN_BACK_MIN_ZEROS = 7;

export interface Comeback {
  /** The day of the Yes that came back. */
  day: DayKey;
  /** Check-in days without a Yes before it. */
  gap: number;
  /** The streak at the last Yes before the gap. */
  before: number;
  /** The gap held a reset: the streak went back to 0. */
  reset: boolean;
  /** Zeros the gap cost. */
  lost: number;
}

/**
 * The comeback the history entry at `index` (the latest by default) makes, or null. It has to be
 * a Yes answered in the app, after COMEBACK_MIN_GAP or more entries that weren't Yeses, with a Yes
 * before them (a head start's counts): a goal that hasn't had a Yes yet has nothing to come back to.
 * Rest days have no entries, so they don't count.
 */
export function comebackAt(goal: GoalState, index = goal.history.length - 1): Comeback | null {
  const yes = goal.history[index];
  if (yes?.result !== 'yes' || isHeadStart(yes)) return null;
  let gap = 0;
  let reset = false;
  for (let i = index - 1; i >= 0; i--) {
    const e = goal.history[i];
    if (!e) break;
    if (e.result === 'yes') {
      if (gap < COMEBACK_MIN_GAP) return null;
      return { day: yes.day, gap, before: e.streakAfter, reset, lost: Math.max(0, e.streakAfter - (yes.streakAfter - 1)) };
    }
    gap++;
    if (e.reset) reset = true;
  }
  return null;
}

/** Every comeback in the goal's history, oldest first. */
export function comebacks(goal: GoalState): Comeback[] {
  const out: Comeback[] = [];
  goal.history.forEach((_, i) => {
    const c = comebackAt(goal, i);
    if (c) out.push(c);
  });
  return out;
}

export function comebackCount(goal: GoalState): number {
  return comebacks(goal).length;
}

/** True once the goal has come back after a reset, which earns the Phoenix theme. */
export function cameBackAfterReset(goal: GoalState): boolean {
  return comebacks(goal).some((c) => c.reset);
}

/** Zeros in the win-back round a comeback gives: the streak it came back from, at least WIN_BACK_MIN_ZEROS. */
export function winBackSize(c: Comeback): number {
  return Math.min(BONUS_MAX_N, Math.max(WIN_BACK_MIN_ZEROS, c.before));
}
