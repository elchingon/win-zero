// Check-in windows (SPEC 2). Day D's window opens at check-in time on D and stays open through
// all of D+1, closing at midnight at its end. The morning reminder falls on D+1, inside the window.
// D+1's own window opens at its check-in time, so the two overlap until midnight; days still
// settle strictly in order, so only the earliest unsettled day is ever pending.
import { addDays, clockMinutes, dayKeyAt, diffDays, MS_PER_HOUR, wallTimeToInstant } from './dates';
import type { CheckInWindow, ClockTime, DayKey, GoalState, ScheduleEntry, TimeZone } from './types';

/** After a schedule change, consecutive openings are kept at least this far apart. */
export const MIN_WINDOW_MS = MS_PER_HOUR;

export function scheduleEntryFor(state: GoalState, day: DayKey): ScheduleEntry {
  const schedule = state.checkInSchedule;
  let entry = schedule[0];
  for (const e of schedule) {
    if (e.fromDay > day) break;
    entry = e;
  }
  if (!entry) throw new Error('Goal has no check-in schedule');
  return entry;
}

/** The entry that applies to future days: the current check-in time and time zone. */
export function latestScheduleEntry(state: GoalState): ScheduleEntry {
  const entry = state.checkInSchedule[state.checkInSchedule.length - 1];
  if (!entry) throw new Error('Goal has no check-in schedule');
  return entry;
}

export function opensAt(state: GoalState, day: DayKey): Date {
  const e = scheduleEntryFor(state, day);
  const wall = wallTimeToInstant(day, e.time, e.tz).getTime();
  if (!e.notBefore) return new Date(wall);
  const floor = Date.parse(e.notBefore) + Math.max(0, diffDays(day, e.fromDay)) * MIN_WINDOW_MS;
  return new Date(Math.max(wall, floor));
}

/** The instant `day` ends: midnight at its end, on a clock in `tz`. */
export function endOfDay(day: DayKey, tz: TimeZone): Date {
  return wallTimeToInstant(addDays(day, 1), '00:00', tz);
}

/**
 * Midnight at the end of D+1, on the clock in D's own zone. That entry never changes once D
 * is open, so an edit or a flight never closes an open window early. Never before D+1's window
 * opens, and at least MIN_WINDOW_MS after the day before closes, which keeps closes strictly
 * increasing across a jump of a day or more (UTC-11 to UTC+14).
 */
export function closesAt(state: GoalState, day: DayKey): Date {
  const next = addDays(day, 1);
  let t = Math.max(endOfDay(next, scheduleEntryFor(state, day).tz).getTime(), opensAt(state, next).getTime());
  if (day > state.firstDay) {
    const prev = addDays(day, -1);
    t = Math.max(t, endOfDay(day, scheduleEntryFor(state, prev).tz).getTime() + MIN_WINDOW_MS);
  }
  return new Date(t);
}

export function windowFor(state: GoalState, day: DayKey): CheckInWindow {
  const next = addDays(day, 1);
  const opens = opensAt(state, day);
  const closes = closesAt(state, day);
  const remind = wallTimeToInstant(next, state.morningTime, scheduleEntryFor(state, next).tz);
  const inside = remind.getTime() > opens.getTime() && remind.getTime() < closes.getTime();
  return {
    day,
    tz: scheduleEntryFor(state, day).tz,
    opensAt: opens,
    remindAt: inside ? remind : null,
    closesAt: closes,
  };
}

/** The earliest day that is neither answered nor missed. */
export function firstUnsettledDay(state: GoalState): DayKey {
  return state.lastSettledDay ? addDays(state.lastSettledDay, 1) : state.firstDay;
}

/** The open, unanswered window at `now`, if any. Expects a state already resolved at `now`. */
export function pendingWindow(state: GoalState, now: Date): CheckInWindow | null {
  const w = windowFor(state, firstUnsettledDay(state));
  const t = now.getTime();
  return w.opensAt.getTime() <= t && t < w.closesAt.getTime() ? w : null;
}

/**
 * The first day, from the earliest unsettled one, whose check-in hasn't arrived by `now`: today's
 * while yesterday's is still open. Expects a state already resolved at `now`, so every unsettled
 * day that has opened is still open.
 */
export function firstUpcomingDay(state: GoalState, now: Date): DayKey {
  let day = firstUnsettledDay(state);
  while (opensAt(state, day).getTime() <= now.getTime()) day = addDays(day, 1);
  return day;
}

/** The window the user answers next: the pending one, or else the next one to open. */
export function nextWindow(state: GoalState): CheckInWindow {
  return windowFor(state, firstUnsettledDay(state));
}

/** True when the window's day is today's local date, so copy can say "today" instead of "yesterday". */
export function isWindowToday(window: CheckInWindow, now: Date): boolean {
  return dayKeyAt(now, window.tz) === window.day;
}

/** Settings rule: the morning reminder must come before check-in time, so it asks about yesterday before today's check-in arrives. */
export function isMorningBeforeCheckIn(morning: ClockTime, checkIn: ClockTime): boolean {
  return clockMinutes(morning) < clockMinutes(checkIn);
}
