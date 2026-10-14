import type { DayKey, GoalState, WeaponId } from '@/engine';

/** Bump when PersistedState changes shape, and teach migratePersisted the old one. */
export const STORE_VERSION = 1;
export const STORE_KEY = 'winzero';

export interface Prefs {
  sound: boolean;
  haptics: boolean;
  /** Weekly nudge after a long break (SPEC 2). */
  reengage: boolean;
  /** Reminders name the goal ("Did you stick to “Stop drinking” today?"). Off keeps it private. */
  goalInReminders: boolean;
}

/** A Yes's rewards, stored by weapon id so they survive a restart. */
export interface RoundRewards {
  bomb: boolean;
  shield: boolean;
  shieldCapped: boolean;
  weapons: WeaponId[];
}

/**
 * The round a Yes earned. Rewards are applied when Yes is answered; the result sheet only
 * reveals them. Kept until the next day settles, so Home can offer an unplayed round.
 */
export interface RoundRecord {
  day: DayKey;
  /** Zeros in the round: the streak after that Yes. */
  n: number;
  rewards: RoundRewards;
  played: boolean;
}

export interface PersistedState {
  goal: GoalState | null;
  /** The player's weapon pick. null means the default, the highest unlocked. */
  weapon: WeaponId | null;
  prefs: Prefs;
  /** Missed days through this one have been shown (Slipping / Reset / Shielded on opening). */
  seenThrough: DayKey | null;
  round: RoundRecord | null;
  /** Development builds only: simulated time travel. Production builds ignore it. */
  devClockOffsetMs: number;
}

export type NoticeCause = 'answer' | 'missed';

/** A screen to show once: what a Not today or a run of missed days did to the streak. */
export type Notice =
  /** Lost zeros, short of the final. */
  | { kind: 'slipping'; cause: NoticeCause; lost: number; streak: number; days: number }
  /** The final, absorbed by a shield. */
  | { kind: 'shielded'; cause: NoticeCause; lost: number; streak: number; shieldsLeft: number; days: number }
  /** The final, with no shield: the streak starts over. */
  | { kind: 'reset'; cause: NoticeCause; lostStreak: number; bestStreak: number; days: number }
  /** A Not today that cost nothing, because the streak was already 0. */
  | { kind: 'noted' };
