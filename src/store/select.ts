// Reading goals out of the store's state (SPEC 9), shared with the website. The free app and the
// website show one goal, the first. Every selector returns something already in the state, or a
// number, so a React selector never sees a fresh object and re-renders for nothing.
import { arsenalReach, celebrationFor, equippedMode, equippedTheme, type GoalState, type ModeId, type ThemeId } from '@/engine';

import type { Limits } from './limits';
import type { GoalSlot, PersistedState, RoundRecord } from './types';

type Goals = Pick<PersistedState, 'goals'>;

/** The first goal's slot: the free app's only goal. */
export const primarySlot = (s: Goals): GoalSlot | null => s.goals[0] ?? null;
export const primaryGoal = (s: Goals): GoalState | null => s.goals[0]?.goal ?? null;
export const primaryRound = (s: Goals): RoundRecord | null => s.goals[0]?.round ?? null;

export function slotById(s: Goals, goalId: string): GoalSlot | null {
  return s.goals.find((slot) => slot.goal.goalId === goalId) ?? null;
}

/** How far the shared arsenal reaches: the best streak any goal has reached, or any goal since removed. */
export const arsenalBestOf = (s: Pick<PersistedState, 'goals' | 'arsenalBest'>): number =>
  arsenalReach(
    s.arsenalBest,
    s.goals.map((slot) => slot.goal),
  );

/** The streak closest to the next unlock: the highest of the goals' current streaks. */
export const arsenalStreakOf = (s: Goals): number => s.goals.reduce((m, slot) => Math.max(m, slot.goal.streak), 0);

/** Bombs banked across every goal: what a bonus round gets to drop for free. */
export const totalBombs = (s: Goals): number => s.goals.reduce((n, slot) => n + slot.goal.bombs, 0);

/** The mode this app plays rounds in: the saved pick while this app offers it, otherwise the Shooter. */
export const gameModeOf = (s: Pick<PersistedState, 'goals' | 'arsenalBest' | 'gameMode'> & { limits: Limits }): ModeId =>
  equippedMode(s.gameMode, arsenalBestOf(s), { modesEnabled: s.limits.modesEnabled });

/** The theme this app draws the round and Home's zeros in: the saved pick while it's offered and earned, otherwise Classic. */
export const themeOf = (s: Pick<PersistedState, 'goals' | 'arsenalBest' | 'theme'> & { limits: Limits }): ThemeId =>
  equippedTheme(s.theme, arsenalBestOf(s), { themesEnabled: s.limits.themesEnabled });

/** Another goal fits under this app's limit. */
export const canAddGoal = (s: Goals & { limits: Limits }): boolean => s.goals.length < s.limits.maxGoals;

/** Win Zero has moved to Win Zero Plus: no reminders here, and Home says where the goals went. */
export const isMovedOut = (s: Pick<PersistedState, 'moveOut'>): boolean => s.moveOut?.status === 'moved';

/**
 * The goal Home's first-round tip follows (SPEC 6): the one with the install's only Yes, once its
 * round has been played, until the tip is closed. A second Yes, on any goal, here or archived,
 * means the first day has passed.
 */
export function firstRoundTipSlot(s: Pick<PersistedState, 'goals' | 'archived' | 'tipsSeen'>): GoalSlot | null {
  if (s.tipsSeen.includes('first-round')) return null;
  let yeses = 0;
  for (const goal of [...s.goals.map((slot) => slot.goal), ...s.archived.map((a) => a.goal)]) {
    for (const entry of goal.history) if (entry.result === 'yes' && ++yeses > 1) return null;
  }
  return yeses === 1 ? (s.goals.find((slot) => slot.round?.played) ?? null) : null;
}

/**
 * The goal Home's next celebration follows (SPEC 6): the first whose latest round has been played
 * and earned one not yet closed. `celebrationFor(slot.round)` says which.
 */
export function celebrationSlot(s: Pick<PersistedState, 'goals' | 'tipsSeen'>): GoalSlot | null {
  return (
    s.goals.find((slot) => {
      const due = slot.round?.played ? celebrationFor(slot.round) : null;
      return due !== null && !s.tipsSeen.includes(due.id);
    }) ?? null
  );
}
