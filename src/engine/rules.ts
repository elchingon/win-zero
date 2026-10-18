// Streak rules (SPEC 3): one pure reducer per event. resolve.ts decides which event applies.
import { milestoneRewards, type MilestoneRewards } from './rewards';
import type { DayKey, DayResult, GoalState, HistoryEntry, TimeZone } from './types';
import { newlyUnlocked, type WeaponDef } from './weapons';

/** Missed days 1–7 in a row cost nothing. From the 8th on, each miss counts as a slip. */
export const MISSED_GRACE_DAYS = 7;
/** The 7th slip since the last Yes is the final: a reset to 0, unless a shield is spent. */
export const SLIDE_FINAL = 7;

export interface SettleContext {
  day: DayKey;
  /** Answer time, or the window's close time for a missed day. */
  at: Date;
  /** Time zone of the day's window. */
  tz: TimeZone;
}

type EntryExtra = Pick<HistoryEntry, 'missedInRow' | 'slip' | 'reset' | 'paused'>;

function settle(
  state: GoalState,
  ctx: SettleContext,
  result: DayResult,
  patch: Partial<GoalState>,
  extra?: EntryExtra,
): GoalState {
  const next = { ...state, ...patch, lastSettledDay: ctx.day };
  const entry: HistoryEntry = {
    id: `${state.goalId}:${ctx.day}`,
    day: ctx.day,
    result,
    at: ctx.at.toISOString(),
    tz: ctx.tz,
    streakAfter: next.streak,
    ...extra,
  };
  return { ...next, history: [...state.history, entry] };
}

export type Final = 'reset' | 'shielded';

export interface Slip {
  /** 1..SLIDE_FINAL: which slip this is since the last Yes or final. */
  n: number;
  streak: number;
  shields: number;
  /** The slide count after this slip: the final starts it over at 0. */
  slide: number;
  final: Final | null;
}

/** One slip: a Not today, or a miss past the grace days. */
export function slip(state: GoalState): Slip {
  const n = state.slide + 1;
  if (n < SLIDE_FINAL) {
    return { n, streak: Math.max(0, state.streak - 1), shields: state.shields, slide: n, final: null };
  }
  // A shield only spends itself when there's a streak to protect.
  if (state.shields > 0 && state.streak > 0) {
    return { n, streak: state.streak, shields: state.shields - 1, slide: 0, final: 'shielded' };
  }
  return { n, streak: 0, shields: state.shields, slide: 0, final: 'reset' };
}

/** State changes shared by every slip. A run ends when the streak reaches 0. */
function slipPatch(state: GoalState, s: Slip): Partial<GoalState> {
  return {
    streak: s.streak,
    shields: s.shields,
    slide: s.slide,
    runPeak: s.streak === 0 ? 0 : state.runPeak,
  };
}

function slipExtra(s: Slip): EntryExtra {
  return s.final === 'reset' ? { slip: s.n, reset: true } : { slip: s.n };
}

export interface YesRewards extends MilestoneRewards {
  weapons: WeaponDef[];
}

/**
 * A Yes. `arsenalBest`: the shared arsenal's reach before it (weapons.ts arsenalReach), so a goal
 * climbing below another goal's best announces no weapon (SPEC 9). One goal alone passes nothing.
 */
export function applyYes(
  state: GoalState,
  ctx: SettleContext,
  arsenalBest = 0,
): { state: GoalState; rewards: YesRewards } {
  const streak = state.streak + 1;
  const bestStreak = Math.max(state.bestStreak, streak);
  const milestones = milestoneRewards(state.runPeak, streak, state.shields);
  const next = settle(state, ctx, 'yes', {
    streak,
    bestStreak,
    runPeak: Math.max(state.runPeak, streak),
    consecutiveMissed: 0,
    slide: 0,
    paused: false,
    bombs: state.bombs + (milestones.bomb ? 1 : 0),
    shields: state.shields + (milestones.shield ? 1 : 0),
  });
  const weapons = newlyUnlocked(Math.max(arsenalBest, state.bestStreak), Math.max(arsenalBest, bestStreak));
  return { state: next, rewards: { ...milestones, weapons } };
}

export interface NotTodayResult {
  state: GoalState;
  slip: Slip;
  /** Zeros this answer cost. */
  lost: number;
}

export function applyNotToday(state: GoalState, ctx: SettleContext): NotTodayResult {
  const s = slip(state);
  const next = settle(
    state,
    ctx,
    s.final === 'shielded' ? 'shielded' : 'no',
    { ...slipPatch(state, s), consecutiveMissed: 0, paused: false },
    slipExtra(s),
  );
  return { state: next, slip: s, lost: state.streak - s.streak };
}

export interface MissedResult {
  state: GoalState;
  missedInRow: number;
  /** One of the first MISSED_GRACE_DAYS misses in a row: nothing lost. */
  grace: boolean;
  /** Recorded after a missed-day reset: counts toward nothing. */
  paused: boolean;
  /** Set when the miss counted as a slip. */
  slip: Slip | null;
}

export function applyMissed(state: GoalState, ctx: SettleContext): MissedResult {
  const missedInRow = state.consecutiveMissed + 1;
  const counted = { consecutiveMissed: missedInRow };

  if (state.paused) {
    const next = settle(state, ctx, 'missed', counted, { missedInRow, paused: true });
    return { state: next, missedInRow, grace: false, paused: true, slip: null };
  }
  if (missedInRow <= MISSED_GRACE_DAYS) {
    const next = settle(state, ctx, 'missed', counted, { missedInRow });
    return { state: next, missedInRow, grace: true, paused: false, slip: null };
  }

  const s = slip(state);
  const next = settle(
    state,
    ctx,
    s.final === 'shielded' ? 'shielded' : 'missed',
    // A reset from missed days stops daily reminders (SPEC 2).
    { ...slipPatch(state, s), ...counted, paused: s.final === 'reset' },
    { missedInRow, ...slipExtra(s) },
  );
  return { state: next, missedInRow, grace: false, paused: false, slip: s };
}
