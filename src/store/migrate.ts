// Turning whatever is in storage into a valid PersistedState. When the stored version differs,
// `migrate` first upgrades it step by step. Then, on every launch, the persist `merge` reads it
// field by field, keeping everything still valid. Saved data is only ever upgraded or kept as
// is: a goal is dropped only when it can't be read at all, and the store backs it up first.
import {
  claimCredits,
  CREDIT_KINDS,
  EMPTY_WALLET,
  isBonusSize,
  isModeId,
  isValidDayKey,
  WEAPONS,
  type CreditGrant,
  type CreditKind,
  type CreditWallet,
  type GoalState,
  type WeaponId,
} from '@/engine';

import {
  MOVE_ID_PATTERN,
  STORE_VERSION,
  type ArchivedGoal,
  type BonusRound,
  type GoalSlot,
  type ImportRecord,
  type MoveOut,
  type PersistedState,
  type Prefs,
  type RoundRecord,
  type RoundRewards,
} from './types';

export const DEFAULT_PREFS: Prefs = { sound: true, haptics: true, reengage: true, goalInReminders: false };

export const DEFAULT_PERSISTED: PersistedState = {
  goals: [],
  archived: [],
  arsenalBest: 0,
  weapon: null,
  gameMode: null,
  prefs: DEFAULT_PREFS,
  credits: EMPTY_WALLET,
  bonus: null,
  reminderCardHiddenUntil: null,
  devClockOffsetMs: 0,
  moveOut: null,
  imports: {},
};

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const count = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : fallback);
const isWeaponId = (v: unknown): v is WeaponId => WEAPONS.some((w) => w.id === v);
const weaponIds = (v: unknown): WeaponId[] => (Array.isArray(v) ? v.filter(isWeaponId) : []);
const isCreditKind = (v: unknown): v is CreditKind => CREDIT_KINDS.some((k) => k === v);
const dayOrNull = (v: unknown) => (typeof v === 'string' && isValidDayKey(v) ? v : null);
const instantOrNull = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

/** One step up: turns data saved at version k into the shape of version k + 1. */
export type Upgrade = (value: Rec) => Rec;

/**
 * Run the steps that take `value` from version `from` up to `to`, in order. Data already at
 * `to`, or saved by a newer build (`from > to`), comes back as it is.
 */
export function applyUpgrades(value: Rec, from: number, to: number, steps: Readonly<Record<number, Upgrade>>): Rec {
  let v = value;
  for (let k = from; k < to; k++) {
    const step = steps[k];
    if (step) v = step(v);
  }
  return v;
}

/** The GoalState shape this build writes (the engine's `version`). */
export const GOAL_VERSION: GoalState['version'] = 1;

/**
 * Steps that bring a saved goal up to GOAL_VERSION, keyed by the version they upgrade from.
 * To change GoalState's shape: bump `version` in the engine (GoalState and createGoal), add the
 * step from the old version here, and test it in migrate.test.ts. Empty until the first change.
 */
const GOAL_UPGRADES: Readonly<Record<number, Upgrade>> = {};

/**
 * Steps that bring a saved blob up to STORE_VERSION, keyed by the version they upgrade from.
 * Version 0 is zustand's default for a blob saved without one (pre-release builds); it needs
 * no step, as the field-by-field read fills in what's missing. To change PersistedState's
 * shape: bump STORE_VERSION, add the step from the old version here, and test it.
 */
const STORE_UPGRADES: Readonly<Record<number, Upgrade>> = {
  // 1 → 2, credits (SPEC v0.5): a goal set up before them earns its Game credit now.
  1: (v) => {
    const goal = normalizeGoal(v.goal);
    return { ...v, credits: goal ? claimCredits(EMPTY_WALLET, { type: 'goal', goal }).wallet : EMPTY_WALLET, bonus: null };
  },
  // 2 → 3, more than one goal (SPEC 9): the goal, its round and its seen mark become the first slot.
  // The old fields stay as they were saved; the field-by-field read ignores them from here on.
  2: (v) => ({
    ...v,
    goals: v.goal != null ? [{ goal: v.goal, round: v.round ?? null, seenThrough: v.seenThrough ?? null }] : [],
    archived: [],
    arsenalBest: 0,
  }),
};

/**
 * A stored goal, upgraded to this build's shape, with fields added after it was saved filled
 * in. Goals saved before they carried a version (pre-release builds) are the first shape. A
 * goal from a newer build (the app was downgraded) is kept as it is, unknown fields and all,
 * rather than lost. Only a blob that isn't a goal at all, or that an upgrade step fails on, is
 * dropped rather than crashing the app.
 */
function normalizeGoal(raw: unknown): GoalState | null {
  if (!isRecord(raw)) return null;
  const from = typeof raw.version === 'number' && Number.isInteger(raw.version) && raw.version >= 1 ? raw.version : 1;
  let v: Rec;
  try {
    v = { ...applyUpgrades(raw, from, GOAL_VERSION, GOAL_UPGRADES), version: Math.max(from, GOAL_VERSION) };
  } catch {
    return null;
  }
  if (typeof v.goalId !== 'string' || typeof v.goal !== 'string' || typeof v.firstDay !== 'string') return null;
  if (!Array.isArray(v.checkInSchedule) || v.checkInSchedule.length === 0 || !Array.isArray(v.history)) return null;
  // Added with the slide rule (SPEC v0.3).
  const goal = { ...(v as unknown as GoalState), slide: count(v.slide, 0), paused: bool(v.paused, false) };
  // A lock-screen name (SPEC 9) that isn't a name is dropped.
  if (goal.alias !== undefined && (typeof goal.alias !== 'string' || !goal.alias.trim())) delete goal.alias;
  return goal;
}

/** The goals stored data holds, active and archived, as saved: before version 3, the one goal. */
function storedGoals(r: Rec): unknown[] {
  if (!Array.isArray(r.goals)) return r.goal != null ? [r.goal] : [];
  const archived = Array.isArray(r.archived) ? r.archived : [];
  return [...r.goals, ...archived].map((s) => (isRecord(s) ? s.goal : s));
}

/**
 * Stored data held a goal that can't be read. Saving now would lose it for good, so the store
 * backs the raw data up first (see STORE_BACKUP_KEY). The goals that can be read are kept.
 */
export function hasUnreadableGoal(raw: unknown): boolean {
  return isRecord(raw) && storedGoals(raw).some((g) => normalizeGoal(g) === null);
}

function normalizeGrant(v: unknown): CreditGrant | null {
  if (!isRecord(v) || !isCreditKind(v.kind) || typeof v.key !== 'string') return null;
  const amount = count(v.amount, 0);
  return amount > 0 ? { kind: v.kind, amount, key: v.key } : null;
}

function normalizeRound(v: unknown): RoundRecord | null {
  if (!isRecord(v) || !isRecord(v.rewards)) return null;
  const day = dayOrNull(v.day);
  if (!day || typeof v.n !== 'number' || !Number.isInteger(v.n) || v.n < 1) return null;
  const r = v.rewards;
  const rewards: RoundRewards = {
    bomb: bool(r.bomb, false),
    shield: bool(r.shield, false),
    shieldCapped: bool(r.shieldCapped, false),
    weapons: weaponIds(r.weapons),
    // Added with credits (SPEC v0.5).
    credits: Array.isArray(r.credits) ? r.credits.map(normalizeGrant).filter((g) => g !== null) : [],
  };
  return { day, n: v.n, rewards, borrowed: weaponIds(v.borrowed), played: bool(v.played, true) };
}

/** A paid-for bonus round. When in doubt it's still there to play: the credit was spent. */
function normalizeBonus(v: unknown): BonusRound | null {
  if (!isRecord(v) || typeof v.n !== 'number' || !isBonusSize(v.n)) return null;
  return { n: v.n, borrowed: weaponIds(v.borrowed), played: bool(v.played, false) };
}

function normalizeWallet(v: unknown): CreditWallet {
  if (!isRecord(v)) return EMPTY_WALLET;
  const balance = isRecord(v.balance) ? v.balance : {};
  const claimed = Array.isArray(v.claimed) ? v.claimed.filter((k): k is string => typeof k === 'string') : [];
  return {
    balance: { game: count(balance.game, 0), weapon: count(balance.weapon, 0) },
    claimed: [...new Set(claimed)],
  };
}

function normalizeSlot(v: unknown): GoalSlot | null {
  if (!isRecord(v)) return null;
  const goal = normalizeGoal(v.goal);
  return goal ? { goal, round: normalizeRound(v.round), seenThrough: dayOrNull(v.seenThrough) } : null;
}

function normalizeArchived(v: unknown): ArchivedGoal | null {
  if (!isRecord(v)) return null;
  const goal = normalizeGoal(v.goal);
  return goal ? { goal, archivedAt: instantOrNull(v.archivedAt) ?? goal.createdAt } : null;
}

/** Stands in for a lost time on a move record, which is kept for its id. */
const LONG_AGO = '1970-01-01T00:00:00.000Z';
const isMoveId = (v: unknown): v is string => typeof v === 'string' && MOVE_ID_PATTERN.test(v);

function normalizeMoveOut(v: unknown): MoveOut | null {
  if (!isRecord(v) || !isMoveId(v.id) || (v.status !== 'sent' && v.status !== 'moved')) return null;
  return { id: v.id, status: v.status, sentAt: instantOrNull(v.sentAt) ?? LONG_AGO };
}

/** Moves taken in, by id. A record whose details are lost still counts: its credits were added. */
function normalizeImports(v: unknown): Record<string, ImportRecord> {
  const imports: Record<string, ImportRecord> = {};
  if (!isRecord(v)) return imports;
  for (const [id, r] of Object.entries(v)) {
    if (!isMoveId(id)) continue;
    const rec = isRecord(r) ? r : {};
    const at = instantOrNull(rec.at) ?? LONG_AGO;
    imports[id] = { at, createdAt: instantOrNull(rec.createdAt) ?? at, game: count(rec.game, 0), weapon: count(rec.weapon, 0) };
  }
  return imports;
}

/** Each goal once, by id: a second copy of an id is dropped, active ones before archived. */
function uniqueGoals<T extends { goal: GoalState }>(items: (T | null)[], seen: Set<string>): T[] {
  const out: T[] = [];
  for (const item of items) {
    if (!item || seen.has(item.goal.goalId)) continue;
    seen.add(item.goal.goalId);
    out.push(item);
  }
  return out;
}

export function normalizePersisted(raw: unknown): PersistedState {
  const r = isRecord(raw) ? raw : {};
  const prefs = isRecord(r.prefs) ? r.prefs : {};
  const offset = r.devClockOffsetMs;
  // Without `goals` (data shaped by version 2, saved under another version number), the one goal.
  const slots = Array.isArray(r.goals)
    ? r.goals
    : r.goal != null
      ? [{ goal: r.goal, round: r.round, seenThrough: r.seenThrough }]
      : [];
  const seen = new Set<string>();
  const goals = uniqueGoals(slots.map(normalizeSlot), seen);
  const archived = uniqueGoals(Array.isArray(r.archived) ? r.archived.map(normalizeArchived) : [], seen);
  return {
    goals,
    archived,
    // Never below what the archived goals reached.
    arsenalBest: archived.reduce((best, a) => Math.max(best, a.goal.bestStreak), count(r.arsenalBest, 0)),
    weapon: isWeaponId(r.weapon) ? r.weapon : null,
    gameMode: isModeId(r.gameMode) ? r.gameMode : null,
    prefs: {
      sound: bool(prefs.sound, DEFAULT_PREFS.sound),
      haptics: bool(prefs.haptics, DEFAULT_PREFS.haptics),
      reengage: bool(prefs.reengage, DEFAULT_PREFS.reengage),
      goalInReminders: bool(prefs.goalInReminders, DEFAULT_PREFS.goalInReminders),
    },
    credits: normalizeWallet(r.credits),
    bonus: normalizeBonus(r.bonus),
    reminderCardHiddenUntil: instantOrNull(r.reminderCardHiddenUntil),
    devClockOffsetMs: typeof offset === 'number' && Number.isFinite(offset) ? offset : 0,
    moveOut: normalizeMoveOut(r.moveOut),
    imports: normalizeImports(r.imports),
  };
}

/**
 * The persist `migrate`, run when the stored version differs from STORE_VERSION: upgrade only.
 * Reading field by field, and dropping what can't be used, happens once, in `merge`, which can
 * then back up a goal before it's lost. A blob from a newer build (a downgrade) is left as it
 * is, as is one an upgrade step fails on: the field-by-field read keeps what it can.
 */
export function migratePersisted(persisted: unknown, fromVersion: number): unknown {
  if (!isRecord(persisted)) return persisted;
  try {
    return applyUpgrades(persisted, fromVersion, STORE_VERSION, STORE_UPGRADES);
  } catch {
    return persisted;
  }
}
