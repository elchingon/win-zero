// Turning whatever is in storage into a valid PersistedState. When the stored version differs,
// `migrate` first upgrades it step by step. Then, on every launch, the persist `merge` reads it
// field by field, keeping everything still valid. Saved data is only ever upgraded or kept as
// is: a goal is dropped only when it can't be read at all, and the store backs it up first.
import { isValidDayKey, WEAPONS, type GoalState, type WeaponId } from '@/engine';

import { STORE_VERSION, type PersistedState, type Prefs, type RoundRecord, type RoundRewards } from './types';

export const DEFAULT_PREFS: Prefs = { sound: true, haptics: true, reengage: true, goalInReminders: false };

export const DEFAULT_PERSISTED: PersistedState = {
  goal: null,
  weapon: null,
  prefs: DEFAULT_PREFS,
  seenThrough: null,
  round: null,
  reminderCardHiddenUntil: null,
  devClockOffsetMs: 0,
};

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const count = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : fallback);
const isWeaponId = (v: unknown): v is WeaponId => WEAPONS.some((w) => w.id === v);
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
const GOAL_VERSION: GoalState['version'] = 1;

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
const STORE_UPGRADES: Readonly<Record<number, Upgrade>> = {};

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
  return { ...(v as unknown as GoalState), slide: count(v.slide, 0), paused: bool(v.paused, false) };
}

/**
 * Stored data held a goal that can't be read. Saving the default state would lose it for good,
 * so the store backs the raw data up first (see STORE_BACKUP_KEY).
 */
export function hasUnreadableGoal(raw: unknown): boolean {
  return isRecord(raw) && raw.goal != null && normalizeGoal(raw.goal) === null;
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
    weapons: Array.isArray(r.weapons) ? r.weapons.filter(isWeaponId) : [],
  };
  return { day, n: v.n, rewards, played: bool(v.played, true) };
}

export function normalizePersisted(raw: unknown): PersistedState {
  const r = isRecord(raw) ? raw : {};
  const prefs = isRecord(r.prefs) ? r.prefs : {};
  const offset = r.devClockOffsetMs;
  return {
    goal: normalizeGoal(r.goal),
    weapon: isWeaponId(r.weapon) ? r.weapon : null,
    prefs: {
      sound: bool(prefs.sound, DEFAULT_PREFS.sound),
      haptics: bool(prefs.haptics, DEFAULT_PREFS.haptics),
      reengage: bool(prefs.reengage, DEFAULT_PREFS.reengage),
      goalInReminders: bool(prefs.goalInReminders, DEFAULT_PREFS.goalInReminders),
    },
    seenThrough: dayOrNull(r.seenThrough),
    round: normalizeRound(r.round),
    reminderCardHiddenUntil: instantOrNull(r.reminderCardHiddenUntil),
    devClockOffsetMs: typeof offset === 'number' && Number.isFinite(offset) ? offset : 0,
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
