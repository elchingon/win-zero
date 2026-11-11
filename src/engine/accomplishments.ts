// What a goal accomplished (SPEC 9), for Win Zero Plus's Past goals, and which goals can be archived
// there: one that reached ARCHIVE_MIN_BEST zeros. A goal that hasn't can be deleted instead. Read
// from the goal and its history only.
import { breakDays } from './breaks';
import { comebackCount } from './comeback';
import { diffDays } from './dates';
import { isHeadStart } from './headStart';
import { historyStats } from './summary';
import type { DayKey, GoalState } from './types';

/** A goal whose best run reached this many zeros can be archived; below it, it can be deleted. */
export const ARCHIVE_MIN_BEST = 7;
/** Best runs worth a badge on Past goals. */
export const MILESTONES: readonly number[] = [7, 14, 30, 60, 100, 180, 365];

/** True when the goal can go to Past goals. A slide after its best never takes that away. */
export function canArchive(goal: GoalState): boolean {
  return goal.bestStreak >= ARCHIVE_MIN_BEST;
}

export type GoalRemoval = 'archive' | 'delete';

/** How a goal leaves: archived once it can be, else deleted. */
export function goalRemoval(goal: GoalState): GoalRemoval {
  return canArchive(goal) ? 'archive' : 'delete';
}

export interface Accomplishments {
  firstDay: DayKey;
  /** The day it ends on: the day it was archived. */
  lastDay: DayKey;
  /** Calendar days from the first day through the last. */
  days: number;
  bestStreak: number;
  /** As historyStats dates it. */
  bestRun: { from: DayKey; to: DayKey } | null;
  /** Days answered Yes, the head start's among them. */
  yesDays: number;
  headStartDays: number;
  /** Check-ins answered in the app, Yes or Not today. */
  answered: number;
  comebacks: number;
  /** Finals a shield took. */
  shieldsUsed: number;
  /** Calendar days it spent on a break, through the last day. */
  breakDays: number;
  /** The MILESTONES the best run reached. */
  milestones: number[];
}

export function goalAccomplishments(goal: GoalState, lastDay: DayKey): Accomplishments {
  const stats = historyStats(goal, lastDay);
  let answered = 0;
  let shieldsUsed = 0;
  for (const e of goal.history) {
    if (!isHeadStart(e) && e.missedInRow === undefined) answered++;
    if (e.result === 'shielded') shieldsUsed++;
  }
  return {
    firstDay: goal.firstDay,
    lastDay,
    days: Math.max(1, diffDays(lastDay, goal.firstDay) + 1),
    bestStreak: goal.bestStreak,
    bestRun: stats.bestRun,
    yesDays: stats.yesDays,
    headStartDays: stats.headStartDays,
    answered,
    comebacks: comebackCount(goal),
    shieldsUsed,
    breakDays: breakDays(goal, lastDay),
    milestones: MILESTONES.filter((m) => goal.bestStreak >= m),
  };
}

export interface AccomplishmentTotals {
  goals: number;
  yesDays: number;
  comebacks: number;
  /** The best run among them. */
  bestStreak: number;
}

/** Past goals added up, for the top of the list. */
export function accomplishmentTotals(goals: readonly GoalState[]): AccomplishmentTotals {
  return goals.reduce<AccomplishmentTotals>(
    (t, g) => ({
      goals: t.goals + 1,
      yesDays: t.yesDays + g.history.filter((e) => e.result === 'yes').length,
      comebacks: t.comebacks + comebackCount(g),
      bestStreak: Math.max(t.bestStreak, g.bestStreak),
    }),
    { goals: 0, yesDays: 0, comebacks: 0, bestStreak: 0 },
  );
}
