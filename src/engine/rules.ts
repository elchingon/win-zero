// Streak rules (SPEC 3): one pure reducer per event. resolve.ts decides which event applies.
import { milestoneRewards, type MilestoneRewards } from './rewards';
import type { DayKey, DayResult, GoalState, HistoryEntry, TimeZone } from './types';
import { newlyUnlocked, type WeaponDef } from './weapons';

/** The 7th consecutive missed day resets the streak and stops daily reminders. */
export const MISSES_UNTIL_RESET = 7;

export interface SettleContext {
  day: DayKey;
  /** Answer time, or the window's close time for a missed day. */
  at: Date;
  /** Time zone of the day's window. */
  tz: TimeZone;
}

function settle(
  state: GoalState,
  ctx: SettleContext,
  result: DayResult,
  patch: Partial<GoalState>,
  extra?: Pick<HistoryEntry, 'missedInRow' | 'reset'>,
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

export interface YesRewards extends MilestoneRewards {
  weapons: WeaponDef[];
}

export function applyYes(state: GoalState, ctx: SettleContext): { state: GoalState; rewards: YesRewards } {
  const streak = state.streak + 1;
  const bestStreak = Math.max(state.bestStreak, streak);
  const milestones = milestoneRewards(state.runPeak, streak, state.shields);
  const next = settle(state, ctx, 'yes', {
    streak,
    bestStreak,
    runPeak: Math.max(state.runPeak, streak),
    consecutiveMissed: 0,
    bombs: state.bombs + (milestones.bomb ? 1 : 0),
    shields: state.shields + (milestones.shield ? 1 : 0),
  });
  return { state: next, rewards: { ...milestones, weapons: newlyUnlocked(state.bestStreak, bestStreak) } };
}

export function applyNotToday(
  state: GoalState,
  ctx: SettleContext,
): { state: GoalState; shielded: boolean; lostStreak: number } {
  // A shield only spends itself when there's a streak to protect.
  if (state.shields > 0 && state.streak > 0) {
    const next = settle(state, ctx, 'shielded', { shields: state.shields - 1, consecutiveMissed: 0 });
    return { state: next, shielded: true, lostStreak: 0 };
  }
  const next = settle(state, ctx, 'no', { streak: 0, runPeak: 0, consecutiveMissed: 0 });
  return { state: next, shielded: false, lostStreak: state.streak };
}

export function applyMissed(
  state: GoalState,
  ctx: SettleContext,
): { state: GoalState; missedInRow: number; reset: boolean } {
  const missedInRow = state.consecutiveMissed + 1;
  const reset = missedInRow === MISSES_UNTIL_RESET;
  const streak = reset ? 0 : Math.max(0, state.streak - 1);
  const next = settle(
    state,
    ctx,
    'missed',
    { streak, runPeak: streak === 0 ? 0 : state.runPeak, consecutiveMissed: missedInRow },
    reset ? { missedInRow, reset: true } : { missedInRow },
  );
  return { state: next, missedInRow, reset };
}
