// Turning whatever is in storage into a valid PersistedState. Runs on every launch (via the
// persist `merge`) and, when the stored version differs, through `migrate` first.
import { isValidDayKey, WEAPONS, type GoalState, type WeaponId } from '@/engine';

import type { PersistedState, Prefs, RoundRecord, RoundRewards } from './types';

export const DEFAULT_PREFS: Prefs = { sound: true, haptics: true, reengage: true, goalInReminders: false };

export const DEFAULT_PERSISTED: PersistedState = {
  goal: null,
  weapon: null,
  prefs: DEFAULT_PREFS,
  seenThrough: null,
  round: null,
  devClockOffsetMs: 0,
};

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const count = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : fallback);
const isWeaponId = (v: unknown): v is WeaponId => WEAPONS.some((w) => w.id === v);
const dayOrNull = (v: unknown) => (typeof v === 'string' && isValidDayKey(v) ? v : null);

/**
 * A stored goal, with fields added after it was saved filled in. A blob that isn't a goal at
 * all can't be used, so it's dropped rather than crashing the app.
 */
function normalizeGoal(v: unknown): GoalState | null {
  if (!isRecord(v) || v.version !== 1) return null;
  if (typeof v.goalId !== 'string' || typeof v.goal !== 'string' || typeof v.firstDay !== 'string') return null;
  if (!Array.isArray(v.checkInSchedule) || v.checkInSchedule.length === 0 || !Array.isArray(v.history)) return null;
  // Added with the slide rule (SPEC v0.3).
  return { ...(v as unknown as GoalState), slide: count(v.slide, 0), paused: bool(v.paused, false) };
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
    devClockOffsetMs: typeof offset === 'number' && Number.isFinite(offset) ? offset : 0,
  };
}

/**
 * Version 1 is the first shipped shape. Version 0 is zustand's default for a blob saved
 * without a version (pre-release builds), and a higher version means a newer build wrote it
 * before a downgrade. Both are read field by field, keeping everything still valid.
 */
export function migratePersisted(persisted: unknown, _fromVersion: number): PersistedState {
  return normalizePersisted(persisted);
}
