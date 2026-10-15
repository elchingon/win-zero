// Catching up on closed windows, answering check-ins, and schedule edits. Every function
// takes `now` and the device time zone `tz` as inputs and returns a new state.
import { addDays, dayKeyAt, isValidClockTime, isValidTimeZone } from './dates';
import { applyMissed, applyNotToday, applyYes, type Final, type YesRewards } from './rules';
import type { ClockTime, DayKey, GoalState, ScheduleEntry, TimeZone } from './types';
import {
  closesAt,
  firstUnsettledDay,
  firstUpcomingDay,
  latestScheduleEntry,
  MIN_WINDOW_MS,
  opensAt,
  pendingWindow,
  scheduleEntryFor,
} from './windows';

export const DEFAULT_CHECK_IN_TIME: ClockTime = '20:00';
export const DEFAULT_MORNING_TIME: ClockTime = '09:00';

function assertTimeZone(tz: string): void {
  if (!isValidTimeZone(tz)) throw new RangeError(`Invalid time zone: ${tz}`);
}

function assertClockTime(time: string): void {
  if (!isValidClockTime(time)) throw new RangeError(`Invalid clock time: ${time}`);
}

function cleanGoal(goal: string): string {
  const trimmed = goal.trim();
  if (!trimmed) throw new RangeError('Goal text is empty');
  return trimmed;
}

export interface CreateGoalInput {
  goalId: string;
  goal: string;
  checkInTime?: ClockTime;
  morningTime?: ClockTime;
  now: Date;
  tz: TimeZone;
}

/**
 * A new goal starts on today's local date. If check-in time has already passed today,
 * today's window is open straight away.
 */
export function createGoal(input: CreateGoalInput): GoalState {
  const checkInTime = input.checkInTime ?? DEFAULT_CHECK_IN_TIME;
  const morningTime = input.morningTime ?? DEFAULT_MORNING_TIME;
  assertClockTime(checkInTime);
  assertClockTime(morningTime);
  assertTimeZone(input.tz);
  const firstDay = dayKeyAt(input.now, input.tz);
  return {
    version: 1,
    goalId: input.goalId,
    goal: cleanGoal(input.goal),
    createdAt: input.now.toISOString(),
    firstDay,
    checkInSchedule: [{ fromDay: firstDay, time: checkInTime, tz: input.tz }],
    morningTime,
    streak: 0,
    bestStreak: 0,
    runPeak: 0,
    shields: 0,
    bombs: 0,
    consecutiveMissed: 0,
    slide: 0,
    paused: false,
    lastSettledDay: null,
    history: [],
  };
}

export interface MissedEvent {
  type: 'missed';
  day: DayKey;
  streakBefore: number;
  streakAfter: number;
  missedInRow: number;
  /** One of the first MISSED_GRACE_DAYS misses in a row: nothing lost. */
  grace: boolean;
  /** The slip number (1–7) when the miss counted as a slip. */
  slip: number | null;
  /** The miss was the final slip: the streak reset, or a shield was spent. */
  final: Final | null;
  /** Recorded after a missed-day reset: counts toward nothing. */
  paused: boolean;
}

export type ResolveEvent = MissedEvent;

export interface Resolved {
  state: GoalState;
  /** What changed, oldest first, so the UI can show Slipping or Reset once. */
  events: ResolveEvent[];
}

/**
 * Settle every window that closed unanswered up to `now`, then follow the device into a new
 * time zone if it changed. Idempotent. Within one time zone it is also path-independent:
 * resolving at t1 and then at t2 gives the same result as resolving at t2 alone. A clock
 * that moves backwards changes nothing that's settled.
 */
export function resolve(state: GoalState, now: Date, tz: TimeZone): Resolved {
  assertTimeZone(tz);
  let next = state;
  const events: ResolveEvent[] = [];
  for (let day = firstUnsettledDay(next); ; day = addDays(day, 1)) {
    const closes = closesAt(next, day);
    if (closes.getTime() > now.getTime()) break;
    const streakBefore = next.streak;
    const r = applyMissed(next, { day, at: closes, tz: scheduleEntryFor(next, day).tz });
    next = r.state;
    events.push({
      type: 'missed',
      day,
      streakBefore,
      streakAfter: next.streak,
      missedInRow: r.missedInRow,
      grace: r.grace,
      slip: r.slip?.n ?? null,
      final: r.slip?.final ?? null,
      paused: r.paused,
    });
  }
  const latest = latestScheduleEntry(next);
  if (latest.tz !== tz) next = appendScheduleEntry(next, { time: latest.time, tz }, now);
  return { state: pruneSchedule(next), events };
}

/**
 * Start a new check-in time or time zone from the first check-in that hasn't arrived yet:
 * today's, even while yesterday's is still open.
 * - That check-in may arrive right away under the new schedule, never earlier.
 * - An open window keeps at least the close time it already had, so an edit or a flight
 *   never closes it early: its own entry is left alone, and if moving the next opening would
 *   pull its close in, that opening stays where it was.
 * - Openings stay strictly increasing, so no day is skipped or repeated.
 * Expects a state already resolved at `now`.
 */
function appendScheduleEntry(
  state: GoalState,
  change: Pick<ScheduleEntry, 'time' | 'tz'>,
  now: Date,
): GoalState {
  const t = now.getTime();
  const fromDay = firstUpcomingDay(state, now);

  const prev = addDays(fromDay, -1);
  const hasPrev = fromDay > state.firstDay;
  let notBefore = hasPrev ? Math.max(t, opensAt(state, prev).getTime() + MIN_WINDOW_MS) : t;
  const withEntry = (floor: number): GoalState => {
    const entry: ScheduleEntry = { fromDay, ...change, notBefore: new Date(floor).toISOString() };
    return { ...state, checkInSchedule: [...state.checkInSchedule.filter((e) => e.fromDay < fromDay), entry] };
  };

  let next = withEntry(notBefore);
  const prevOpen = hasPrev && prev >= firstUnsettledDay(state);
  if (prevOpen && closesAt(next, prev).getTime() < closesAt(state, prev).getTime()) {
    notBefore = Math.max(notBefore, opensAt(state, fromDay).getTime());
    next = withEntry(notBefore);
  }
  return next;
}

/** Drop schedule entries that no longer govern the last settled day or anything after it. */
function pruneSchedule(state: GoalState): GoalState {
  const keepFrom = state.lastSettledDay ?? state.firstDay;
  const schedule = state.checkInSchedule;
  let start = 0;
  for (let i = 0; i < schedule.length; i++) {
    const e = schedule[i];
    if (e && e.fromDay <= keepFrom) start = i;
  }
  return start === 0 ? state : { ...state, checkInSchedule: schedule.slice(start) };
}

export type Answer = 'yes' | 'not-today';

/**
 * - `slipped`: Not today #1–#6 since the last Yes, which costs one zero (none at streak 0).
 * - `shielded` / `reset`: the final slip, saved by a shield or not.
 */
export type AnswerOutcome =
  | { kind: 'yes'; day: DayKey; streak: number; rewards: YesRewards }
  | { kind: 'slipped'; day: DayKey; streak: number; slip: number; lost: number }
  | { kind: 'shielded'; day: DayKey; streak: number; shieldsLeft: number }
  | { kind: 'reset'; day: DayKey; lostStreak: number };

/**
 * - `not-open`: no window is open for that day yet.
 * - `already-answered`: the day was answered before (a second tap on the same notification).
 * - `expired`: the day's window closed and it was recorded as missed.
 */
export type AnswerRejection = 'not-open' | 'already-answered' | 'expired';

export type AnswerResult =
  | { ok: true; state: GoalState; events: ResolveEvent[]; outcome: AnswerOutcome }
  | { ok: false; state: GoalState; events: ResolveEvent[]; reason: AnswerRejection };

export interface AnswerInput {
  answer: Answer;
  /** The day being answered, e.g. from a notification. Defaults to the pending window. */
  day?: DayKey;
}

/**
 * Answer a check-in. Catches up first, so a rejection still returns the up-to-date state and
 * any missed-day events.
 */
export function answer(state: GoalState, input: AnswerInput, now: Date, tz: TimeZone): AnswerResult {
  const { state: current, events } = resolve(state, now, tz);
  const pending = pendingWindow(current, now);
  const day = input.day ?? pending?.day;
  const reject = (reason: AnswerRejection): AnswerResult => ({ ok: false, state: current, events, reason });

  if (!day) return reject('not-open');
  if (pending && day === pending.day) {
    const ctx = { day, at: now, tz: pending.tz };
    if (input.answer === 'yes') {
      const r = applyYes(current, ctx);
      return {
        ok: true,
        state: r.state,
        events,
        outcome: { kind: 'yes', day, streak: r.state.streak, rewards: r.rewards },
      };
    }
    const r = applyNotToday(current, ctx);
    const outcome: AnswerOutcome =
      r.slip.final === 'shielded'
        ? { kind: 'shielded', day, streak: r.state.streak, shieldsLeft: r.state.shields }
        : r.slip.final === 'reset'
          ? { kind: 'reset', day, lostStreak: r.lost }
          : { kind: 'slipped', day, streak: r.state.streak, slip: r.slip.n, lost: r.lost };
    return { ok: true, state: r.state, events, outcome };
  }
  if (day >= firstUnsettledDay(current)) return reject('not-open');
  for (let i = current.history.length - 1; i >= 0; i--) {
    const entry = current.history[i];
    if (entry?.day === day) return reject(entry.result === 'missed' ? 'expired' : 'already-answered');
  }
  return reject('expired');
}

/** Change the check-in time. It takes effect from the next window that hasn't opened. */
export function setCheckInTime(state: GoalState, time: ClockTime, now: Date, tz: TimeZone): Resolved {
  assertClockTime(time);
  const resolved = resolve(state, now, tz);
  const latest = latestScheduleEntry(resolved.state);
  if (latest.time === time) return resolved;
  return {
    state: pruneSchedule(appendScheduleEntry(resolved.state, { time, tz: latest.tz }, now)),
    events: resolved.events,
  };
}

/** Change the morning reminder time. It affects reminders only, never window boundaries. */
export function setMorningTime(state: GoalState, time: ClockTime): GoalState {
  assertClockTime(time);
  return { ...state, morningTime: time };
}

/** Edit the goal's wording. The streak and history carry over. */
export function setGoalText(state: GoalState, goal: string): GoalState {
  return { ...state, goal: cleanGoal(goal) };
}

/** The check-in time that applies to upcoming days. */
export function currentCheckInTime(state: GoalState): ClockTime {
  return latestScheduleEntry(state).time;
}
