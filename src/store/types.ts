import type {
  AnswerRejection,
  CreditGrant,
  CreditWallet,
  DayKey,
  GoalState,
  HistoryEntry,
  IsoInstant,
  ModeId,
  ThemeId,
  WeaponId,
} from '@/engine';

/** Bump when PersistedState changes shape, and teach migratePersisted the old one. */
export const STORE_VERSION = 3;
export const STORE_KEY = 'winzero';
/** Where stored data goes when its goal can't be read, so a later fix can bring it back. */
export const STORE_BACKUP_KEY = `${STORE_KEY}:unreadable`;
/**
 * A move's id (SPEC 9: Win Zero to Win Zero Plus). It travels in a link and names the file the move
 * is left in, so it's letters, digits and dashes only.
 */
export const MOVE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

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
  /** Credits the Yes earned, already in the wallet. */
  credits: CreditGrant[];
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
  /** Weapons not yet unlocked that a Weapon credit lent this round. */
  borrowed: WeaponId[];
  played: boolean;
}

/**
 * A bonus round, paid for with a Game credit: any number of zeros, and nothing about the streak
 * or rewards changes. Kept until played, so a credit spent is never lost to a closed app.
 */
export interface BonusRound {
  n: number;
  /** Weapons not yet unlocked that a Weapon credit lent this round. */
  borrowed: WeaponId[];
  played: boolean;
}

/** The round a Weapon credit lends to: a goal's day's round, or the bonus round. */
export type CreditRound = { round: 'daily'; goalId: string } | { round: 'bonus' };

/** One goal, with what belongs to it alone: the round its latest Yes earned, and the news shown. */
export interface GoalSlot {
  goal: GoalState;
  round: RoundRecord | null;
  /** Missed days through this one have been shown (Slipping / Reset / Shielded on opening). */
  seenThrough: DayKey | null;
}

/** A goal set aside (SPEC 9): its history kept to read, with no reminders, and its slot free. */
export interface ArchivedGoal {
  goal: GoalState;
  archivedAt: IsoInstant;
}

/**
 * Win Zero's move to Win Zero Plus (SPEC 9). `sent` from the first try, with one id for every
 * try so Plus adds the credits once; `moved` once Plus confirms the move arrived. While moved,
 * Win Zero schedules no reminders, until the user chooses to keep using it.
 */
export interface MoveOut {
  id: string;
  status: 'sent' | 'moved';
  /** The latest try, so Win Zero can ask whether a move it never heard back about finished. */
  sentAt: IsoInstant;
}

/** A move Win Zero Plus took in. Its credits are added once, however often it arrives. */
export interface ImportRecord {
  /** When Plus took it in. */
  at: IsoInstant;
  /** When Win Zero made it. */
  createdAt: IsoInstant;
  /** The credits it added. */
  game: number;
  weapon: number;
}

export interface PersistedState {
  /** The goals, in the order they're shown. The free app keeps at most one (Limits). */
  goals: GoalSlot[];
  archived: ArchivedGoal[];
  /**
   * The best streak goals no longer here reached (archived or deleted), so removing a goal never
   * takes a weapon away. The shared arsenal reaches this or any goal's bestStreak (arsenalReach).
   */
  arsenalBest: number;
  /** The player's weapon pick. null means the default, the highest unlocked. */
  weapon: WeaponId | null;
  /** The game mode picked in Settings › Games (Win Zero Plus). null means the Shooter. */
  gameMode: ModeId | null;
  /** The theme picked in Settings › Themes (Win Zero Plus). null means Classic. */
  theme: ThemeId | null;
  prefs: Prefs;
  /** Game and Weapon credits. They outlive a goal; Erase all data clears them with everything else. */
  credits: CreditWallet;
  bonus: BonusRound | null;
  /** "Not now" on Home's reminders-off card hides it until then. */
  reminderCardHiddenUntil: IsoInstant | null;
  /** Development builds only: simulated time travel. Production builds ignore it. */
  devClockOffsetMs: number;
  /** Win Zero: its move to Win Zero Plus, from the first try until it's cancelled or the user stays. */
  moveOut: MoveOut | null;
  /** Win Zero Plus: the moves it took in, by id. */
  imports: Readonly<Record<string, ImportRecord>>;
}

/** What a move's merge (src/transfer/merge.ts) gives Win Zero Plus to save. */
export type ImportedState = Pick<
  PersistedState,
  'goals' | 'archived' | 'arsenalBest' | 'weapon' | 'prefs' | 'credits' | 'imports'
>;

/** A merged move, and the goals whose copy here it replaced; or why it can't be taken in. */
export type ImportOutcome =
  | { ok: true; state: ImportedState; replaced: readonly string[] }
  | { ok: false; reason: 'full' };

/**
 * Version 2's single-goal fields, copied from the first goal on every save for one release: a
 * build still on version 2 (a /play tab left open, a downgraded app) then reads that goal instead
 * of saving an empty state over it. Version 3 reads `goals` only. Drop with version 4.
 */
export interface LegacyCopy {
  goal: GoalState | null;
  round: RoundRecord | null;
  seenThrough: DayKey | null;
}

/**
 * The screen an accepted answer opens: Yes on Home's card plays the round, Not today shows its
 * notice. A Yes from a notification opens nothing: Home shows the round, ready when the user is.
 */
export type AnswerRoute = '/play' | '/notice';

/** Where the latest answer leads, and whose goal it answered. */
export interface PendingRoute {
  path: AnswerRoute;
  goalId: string;
}

/** Why the latest answer was turned down, and whose goal it was for. */
export interface Rejection {
  reason: AnswerRejection;
  goalId: string;
}

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
  goalId: string;
  /** The day that was answered. */
  day: DayKey;
  /** When it was answered, in epoch ms on the app clock. */
  at: number;
  /** The notice that answer left, so the Notice screen knows the Undo is its own. */
  notice: Notice | null;
  /** The history entry the answer recorded. Once another day settles, it's too late. */
  entry: HistoryEntry | undefined;
  /** The goal and its round from just before (a Not today drops yesterday's round). */
  before: { goal: GoalState; round: RoundRecord | null };
}

/**
 * The next one-time screen and where it came from. An answer's notice waits in the store;
 * missed-day news is worked out from history, and counts as seen through `through` once shown.
 */
export type PendingNotice =
  | { source: 'answer'; goalId: string; notice: Notice }
  | { source: 'missed'; goalId: string; notice: Notice; through: DayKey };
