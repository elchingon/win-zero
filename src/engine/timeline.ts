// A goal's days ahead, as the moments its state changes with nobody answering (SPEC 9, Win Zero
// Plus's widgets): a check-in opens, one closes (missed, maybe slipping), or the day turns over,
// which a break's days and the words "today" and "tomorrow" follow. Each moment is read by
// resolving the goal at it, so the real rules decide and nothing here adds one.
import { breakStatus, type BreakStatus } from './breaks';
import { addDays, dayKeyAt } from './dates';
import { nextGoalDay } from './goalDays';
import { resolve } from './resolve';
import type { CheckInWindow, DayKey, GoalState, TimeZone } from './types';
import { closesAt, endOfDay, firstUnsettledDay, nextWindow, opensAt, pendingWindow } from './windows';

/** How far ahead a timeline looks, like the reminders' plan. */
export const TIMELINE_HORIZON_DAYS = 14;

export interface GoalMoment {
  /** When this moment starts; it lasts until the next one. */
  at: Date;
  streak: number;
  /** Reminders paused after a missed-day reset (GoalState.paused). */
  paused: boolean;
  /** The latest settled day, which says whether a round's Yes is still the latest. */
  settledThrough: DayKey | null;
  /** The check-in open now, or null. */
  open: CheckInWindow | null;
  /** The check-in to answer next: the open one, or the next to open. */
  next: CheckInWindow;
  /** A break running, or still to start, or null. Not one whose days are over. */
  onBreak: BreakStatus | null;
}

/** The goal as it stands at `t`, with nothing answered after it. */
function momentAt(state: GoalState, t: Date, tz: TimeZone): GoalMoment {
  const s = resolve(state, t, tz).state;
  const status = breakStatus(s, t);
  return {
    at: t,
    streak: s.streak,
    paused: s.paused,
    settledThrough: s.lastSettledDay,
    open: pendingWindow(s, t),
    next: nextWindow(s),
    onBreak: status && status.when !== 'over' ? status : null,
  };
}

/**
 * The goal's moments from `now` until `until` (at most TIMELINE_HORIZON_DAYS ahead), the first at
 * `now`, in order, assuming no answer comes. `tz` is the phone's, as resolve takes it.
 */
export function goalTimeline(state: GoalState, now: Date, tz: TimeZone, until: Date): GoalMoment[] {
  const start = resolve(state, now, tz).state;
  const end = Math.min(until.getTime(), endOfDay(addDays(dayKeyAt(now, tz), TIMELINE_HORIZON_DAYS), tz).getTime());
  const t0 = now.getTime();
  const points = new Set<number>();
  // Each check-in opening and closing.
  for (let day = firstUnsettledDay(start); opensAt(start, day).getTime() <= end; day = nextGoalDay(start, day)) {
    for (const t of [opensAt(start, day).getTime(), closesAt(start, day).getTime()]) if (t > t0 && t <= end) points.add(t);
  }
  // Each midnight on the phone's clock.
  for (let day = dayKeyAt(now, tz); ; day = addDays(day, 1)) {
    const t = endOfDay(day, tz).getTime();
    if (t > end) break;
    if (t > t0) points.add(t);
  }
  return [t0, ...[...points].sort((a, b2) => a - b2)].map((t) => momentAt(start, new Date(t), tz));
}
