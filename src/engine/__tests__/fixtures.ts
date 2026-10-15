import { addDays, wallTimeToInstant } from '../dates';
import { answer, createGoal, type Answer, type AnswerOutcome } from '../resolve';
import type { ClockTime, DayKey, GoalState, TimeZone } from '../types';

export const DENVER = 'America/Denver';
export const LA = 'America/Los_Angeles';
export const NEW_YORK = 'America/New_York';
export const TOKYO = 'Asia/Tokyo';
export const HONOLULU = 'Pacific/Honolulu';
export const LONDON = 'Europe/London';
export const PAGO_PAGO = 'Pacific/Pago_Pago'; // UTC-11
export const KIRITIMATI = 'Pacific/Kiritimati'; // UTC+14
export const SANTIAGO = 'America/Santiago'; // DST starts at midnight

/** Setup day used by most tests: a Tuesday, two weeks before the US fall-back change. */
export const DAY0 = '2026-10-13';

/** The instant a local wall clock in `tz` reads `time` on `day`. */
export function at(day: DayKey, time: ClockTime, tz: TimeZone = DENVER): Date {
  return wallTimeToInstant(day, time, tz);
}

export const iso = (s: string) => new Date(s);

export function newGoal(
  opts: {
    day?: DayKey;
    time?: ClockTime;
    tz?: TimeZone;
    checkInTime?: ClockTime;
    morningTime?: ClockTime;
  } = {},
): GoalState {
  const tz = opts.tz ?? DENVER;
  return createGoal({
    goalId: 'g1',
    goal: 'Stop drinking',
    checkInTime: opts.checkInTime,
    morningTime: opts.morningTime,
    now: at(opts.day ?? DAY0, opts.time ?? '12:00', tz),
    tz,
  });
}

/** Answer `day`'s window at `time` local (default 21:00 that day) and return the accepted result. */
export function answerDay(
  state: GoalState,
  day: DayKey,
  ans: Answer,
  opts: { time?: ClockTime; timeDay?: DayKey; tz?: TimeZone } = {},
): { state: GoalState; outcome: AnswerOutcome } {
  const tz = opts.tz ?? DENVER;
  const r = answer(state, { answer: ans, day }, at(opts.timeDay ?? day, opts.time ?? '21:00', tz), tz);
  if (!r.ok) throw new Error(`Answer for ${day} rejected: ${r.reason}`);
  return { state: r.state, outcome: r.outcome };
}

/** Answer Yes on `n` consecutive days starting at `from`. */
export function yesDays(state: GoalState, from: DayKey, n: number, tz: TimeZone = DENVER): GoalState {
  let s = state;
  for (let i = 0; i < n; i++) s = answerDay(s, addDays(from, i), 'yes', { tz }).state;
  return s;
}

/** Answer Not today on `n` consecutive days starting at `from`. */
export function notTodays(state: GoalState, from: DayKey, n: number, tz: TimeZone = DENVER): GoalState {
  let s = state;
  for (let i = 0; i < n; i++) s = answerDay(s, addDays(from, i), 'not-today', { tz }).state;
  return s;
}

/** A state with chosen counters, for testing the reducers directly. */
export function stateWith(patch: Partial<GoalState>): GoalState {
  return { ...newGoal(), ...patch };
}

/** Deterministic pseudo-random numbers for property-style tests. */
export function seeded(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}
