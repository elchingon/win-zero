// Bombs and streak shields (SPEC 5). Weapons live in weapons.ts.
import type { GoalState } from './types';

export const BOMB_EVERY = 5;
export const SHIELD_EVERY = 7;
export const SHIELD_CAP = 3;

export interface MilestoneRewards {
  bomb: boolean;
  shield: boolean;
  /** A shield milestone was reached while already holding SHIELD_CAP. */
  shieldCapped: boolean;
}

/**
 * Rewards for reaching `streak` on a Yes. Milestones pay out only above the run's previous
 * peak, so dipping on a missed day and climbing back doesn't earn the same bomb twice.
 */
export function milestoneRewards(prevRunPeak: number, streak: number, shields: number): MilestoneRewards {
  const fresh = streak > prevRunPeak;
  const shieldDue = fresh && streak % SHIELD_EVERY === 0;
  return {
    bomb: fresh && streak % BOMB_EVERY === 0,
    shield: shieldDue && shields < SHIELD_CAP,
    shieldCapped: shieldDue && shields >= SHIELD_CAP,
  };
}

/** Spend one bomb (in any round, Replay included). */
export function spendBomb(state: GoalState): GoalState {
  if (state.bombs < 1) throw new RangeError('No bombs to spend');
  return { ...state, bombs: state.bombs - 1 };
}
