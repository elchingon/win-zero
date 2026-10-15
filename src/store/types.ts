import type { DayKey, GoalState, HistoryEntry, WeaponId } from '@/engine';

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

/**
 * The screen an accepted answer opens: Yes on Home's card plays the round, Not today shows its
 * notice. A Yes from a notification opens nothing: Home shows the round, ready when the user is.
 */
export type AnswerRoute = '/play' | '/notice';

/** Where an answer came from: Home's card, or a notification's buttons. */
export type AnswerSource = 'app' | 'notification';

export type NoticeCause = 'answer' | 'missed';

/** A screen to show once: what a Not today or a run of missed days did to the streak. */
export type Notice =
  /** Lost zeros, short of the final. `stopped`: a Yes has since stopped the slide. */
  | { kind: 'slipping'; cause: NoticeCause; lost: number; streak: number; days: number; stopped: boolean }
  /** The final, absorbed by a shield. */
  | { kind: 'shielded'; cause: NoticeCause; lost: number; streak: number; shieldsLeft: number; days: number }
  /** The final, with no shield: the streak starts over. `stopped`: a Yes has since begun a new run. */
  | { kind: 'reset'; cause: NoticeCause; lostStreak: number; bestStreak: number; days: number; stopped: boolean }
  /** A Not today that cost nothing, because the streak was already 0. */
  | { kind: 'noted' };

/**
 * A Not today that can still be taken back, for a mis-tap. It holds the state from just before
 * the answer, which comes back whole. Not persisted.
 */
export interface UndoNotToday {
  /** The day that was answered. */
  day: DayKey;
  /** When it was answered, in epoch ms on the app clock. */
  at: number;
  /** The notice that answer left, so the Notice screen knows the Undo is its own. */
  notice: Notice | null;
  /** The history entry the answer recorded. Once another day settles, it's too late. */
  entry: HistoryEntry | undefined;
  /** The goal and round from just before (a Not today drops yesterday's round). */
  before: { goal: GoalState; round: RoundRecord | null };
}

/**
 * The next one-time screen and where it came from. An answer's notice waits in the store;
 * missed-day news is worked out from history, and counts as seen through `through` once shown.
 */
export type PendingNotice =
  | { source: 'answer'; notice: Notice }
  | { source: 'missed'; notice: Notice; through: DayKey };
