// Breaks (SPEC 9, Win Zero Plus): a goal can take days off for travel or illness. A break's days work
// like rest days (goalDays.ts isGoalDay): no window, no history entry and no effect. Nothing is lost
// or gained, and a run of missed days already counting carries over it: rules.ts never sees a break.
// - A break starts on a check-in day that hasn't opened yet, so an open one is never paused, and
//   lasts at most BREAK_MAX_DAYS calendar days.
// - Its end can move, earlier or later, until the first check-in after it opens. Only then can a new
//   one start, so breaks are never chained back to back.
// - Days already over never change: a break's end never moves back before yesterday, and Resume now
//   opens today's check-in straight away when its time has passed.
import { addDays, dayKeyAt, diffDays, isValidDayKey } from './dates';
import { latestScheduleEntry, nextGoalDay } from './goalDays';
import { resolve, type ResolveEvent } from './resolve';
import type { CheckInWindow, DayKey, GoalBreak, GoalState, TimeZone } from './types';
import { closesAt, firstUnsettledDay, firstUpcomingDay, opensAt, windowFor } from './windows';

/** The longest a break can last, in calendar days from its first. */
export const BREAK_MAX_DAYS = 14;

/**
 * - `too-long`: it would last more than BREAK_MAX_DAYS days.
 * - `ends-before-start`: its end comes before its first day.
 * - `already-on-break`: a break is running, or its next check-in hasn't opened yet.
 * - `no-break`: there's no break to change.
 * - `check-in-open`: it would start on a check-in that has already opened.
 * - `in-the-past`: its end would move back before yesterday, which is already over.
 * - `invalid-day`: not a calendar date.
 */
export type BreakRejection =
  | 'too-long'
  | 'ends-before-start'
  | 'already-on-break'
  | 'no-break'
  | 'check-in-open'
  | 'in-the-past'
  | 'invalid-day';

export type BreakResult =
  | { ok: true; state: GoalState; events: ResolveEvent[] }
  | { ok: false; state: GoalState; events: ResolveEvent[]; reason: BreakRejection };

/** The last day a break starting on `from` can run to. */
export function latestBreakEnd(from: DayKey): DayKey {
  return addDays(from, BREAK_MAX_DAYS - 1);
}

/** The earliest day a break can start: the first check-in that hasn't opened. Expects a state resolved at `now`. */
export function breakStartDay(state: GoalState, now: Date): DayKey {
  return firstUpcomingDay(state, now);
}

/** The break `day` falls in, if any. */
export function breakCovering(state: GoalState, day: DayKey): GoalBreak | null {
  return state.breaks?.find((b) => b.from <= day && day <= b.to) ?? null;
}

/** The window of the first check-in after a break. */
export function breakResumes(state: GoalState, b: GoalBreak): CheckInWindow {
  return windowFor(state, nextGoalDay(state, b.to));
}

/**
 * The break whose end can still move: the last one, until the first check-in after it opens. It may
 * not have started yet. Expects a state resolved at `now`.
 */
export function activeBreak(state: GoalState, now: Date): GoalBreak | null {
  const b = state.breaks?.[state.breaks.length - 1];
  return b && breakResumes(state, b).opensAt.getTime() > now.getTime() ? b : null;
}

export interface BreakStatus {
  break: GoalBreak;
  /** Today, on the goal's clock, is before the break, one of its days, or after it. */
  when: 'ahead' | 'on' | 'over';
  /** The first check-in after it. */
  resumes: CheckInWindow;
}

/** The active break and where today stands in it, for Home and the goal screen. Expects a state resolved at `now`. */
export function breakStatus(state: GoalState, now: Date): BreakStatus | null {
  const b = activeBreak(state, now);
  if (!b) return null;
  const today = dayKeyAt(now, latestScheduleEntry(state).tz);
  return { break: b, when: today < b.from ? 'ahead' : today <= b.to ? 'on' : 'over', resumes: breakResumes(state, b) };
}

/** Calendar days of the goal's breaks up to and including `through`. */
export function breakDays(state: GoalState, through: DayKey): number {
  let days = 0;
  for (const b of state.breaks ?? []) {
    if (b.from > through) break;
    days += diffDays(b.to < through ? b.to : through, b.from) + 1;
  }
  return days;
}

/** True when a window open at `now` closes earlier in `after` than in `before`. */
function closesAnOpenWindowEarly(before: GoalState, after: GoalState, now: Date): boolean {
  for (let d = firstUnsettledDay(before); opensAt(before, d).getTime() <= now.getTime(); d = nextGoalDay(before, d)) {
    if (closesAt(after, d).getTime() < closesAt(before, d).getTime()) return true;
  }
  return false;
}

/** The goal with its last break replaced by `b`, or removed when `b` is null. */
function withLastBreak(state: GoalState, b: GoalBreak | null): GoalState {
  const kept = (state.breaks ?? []).slice(0, -1);
  const breaks = b ? [...kept, b] : kept;
  if (breaks.length) return { ...state, breaks };
  const { breaks: _gone, ...rest } = state;
  return rest;
}

/**
 * Start a break that runs through `until`. It starts on `from`, by default the first check-in that
 * hasn't opened. Catches up first, so a rejection still returns the up-to-date state.
 */
export function startBreak(state: GoalState, until: DayKey, now: Date, tz: TimeZone, from?: DayKey): BreakResult {
  const { state: s, events } = resolve(state, now, tz);
  const reject = (reason: BreakRejection): BreakResult => ({ ok: false, state: s, events, reason });
  if (!isValidDayKey(until) || (from !== undefined && !isValidDayKey(from))) return reject('invalid-day');
  if (activeBreak(s, now)) return reject('already-on-break');

  const earliest = breakStartDay(s, now);
  let start = from ?? earliest;
  if (start < earliest) return reject('check-in-open');
  if (until < start) return reject('ends-before-start');
  if (until > latestBreakEnd(start)) return reject('too-long');
  // Whether the day after an open window is a check-in day can matter to when it closes (it never
  // closes before that check-in opens): if the break would close one early, start it a day later.
  for (;;) {
    const next = { ...s, breaks: [...(s.breaks ?? []), { from: start, to: until }] };
    if (!closesAnOpenWindowEarly(s, next, now)) return { ok: true, state: next, events };
    start = addDays(start, 1);
    if (until < start) return reject('check-in-open');
  }
}

/**
 * Move the active break's end to `until`: later, up to BREAK_MAX_DAYS days from its start, or
 * earlier, to yesterday at the earliest. An end before its start cancels it.
 */
export function setBreakEnd(state: GoalState, until: DayKey, now: Date, tz: TimeZone): BreakResult {
  const { state: s, events } = resolve(state, now, tz);
  const reject = (reason: BreakRejection): BreakResult => ({ ok: false, state: s, events, reason });
  if (!isValidDayKey(until)) return reject('invalid-day');
  const b = activeBreak(s, now);
  if (!b) return reject('no-break');
  if (until === b.to) return { ok: true, state: s, events };
  if (until > latestBreakEnd(b.from)) return reject('too-long');
  const yesterday = addDays(dayKeyAt(now, latestScheduleEntry(s).tz), -1);
  if (until < b.to && until < yesterday) return reject('in-the-past');

  const next = withLastBreak(s, until < b.from ? null : { from: b.from, to: until });
  if (closesAnOpenWindowEarly(s, next, now)) return reject('check-in-open');
  return { ok: true, state: next, events };
}

/**
 * Resume now: the active break ends with yesterday, so today checks in again (straight away when its
 * check-in time has passed). One that hasn't started is cancelled; one whose days are over is left.
 */
export function endBreak(state: GoalState, now: Date, tz: TimeZone): BreakResult {
  const { state: s, events } = resolve(state, now, tz);
  const b = activeBreak(s, now);
  if (!b) return { ok: false, state: s, events, reason: 'no-break' };
  const yesterday = addDays(dayKeyAt(now, latestScheduleEntry(s).tz), -1);
  return b.to <= yesterday ? { ok: true, state: s, events } : setBreakEnd(s, yesterday, now, tz);
}
