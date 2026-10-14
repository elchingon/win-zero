// Check-in windows (SPEC 2). Day D's window opens at check-in time on D and closes when
// D+1's window opens. The morning reminder falls on D+1, inside the window.
import { addDays, clockMinutes, dayKeyAt, diffDays, MS_PER_HOUR, wallTimeToInstant } from './dates';
import type { CheckInWindow, ClockTime, DayKey, GoalState, ScheduleEntry } from './types';

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

export function closesAt(state: GoalState, day: DayKey): Date {
  return opensAt(state, addDays(day, 1));
}

export function windowFor(state: GoalState, day: DayKey): CheckInWindow {
  const next = addDays(day, 1);
  const opens = opensAt(state, day);
  const closes = opensAt(state, next);
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

/** The window the user answers next: the pending one, or else the next one to open. */
export function nextWindow(state: GoalState): CheckInWindow {
  return windowFor(state, firstUnsettledDay(state));
}

/** True when the window's day is today's local date, so copy can say "today" instead of "yesterday". */
export function isWindowToday(window: CheckInWindow, now: Date): boolean {
  return dayKeyAt(now, window.tz) === window.day;
}

/** Settings rule: the morning reminder must come before check-in time to land inside the window. */
export function isMorningBeforeCheckIn(morning: ClockTime, checkIn: ClockTime): boolean {
  return clockMinutes(morning) < clockMinutes(checkIn);
}
