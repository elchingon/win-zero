/** Local calendar date of a goal day, 'YYYY-MM-DD'. */
export type DayKey = string;
/** Wall-clock time, 24h 'HH:mm'. */
export type ClockTime = string;
/** IANA time zone name, e.g. 'America/Denver'. */
export type TimeZone = string;
/** ISO-8601 instant in UTC, e.g. '2026-10-14T02:00:00.000Z'. */
export type IsoInstant = string;

/**
 * Check-in time in force from `fromDay` until the next entry. A new entry is appended when
 * the user edits the time or the device changes time zone (see resolve.ts).
 */
export interface ScheduleEntry {
  fromDay: DayKey;
  time: ClockTime;
  tz: TimeZone;
  /**
   * Openings in this entry are clamped so they never come before this instant, which keeps
   * an open window from closing early and keeps openings strictly increasing.
   */
  notBefore?: IsoInstant;
}

export type DayResult = 'yes' | 'no' | 'shielded' | 'missed';

/** One settled goal day. History is append-only; entries are never edited. */
export interface HistoryEntry {
  /** Stable id for a future sync backend: `${goalId}:${day}`. */
  id: string;
  day: DayKey;
  result: DayResult;
  /** When it was answered, or for a missed day, when its window closed. */
  at: IsoInstant;
  /** Time zone the day's window was scheduled in. */
  tz: TimeZone;
  streakAfter: number;
  /** Missed days only: consecutive misses including this one. */
  missedInRow?: number;
  /** Missed days only: this miss was the one that reset the streak. */
  reset?: true;
}

export interface GoalState {
  version: 1;
  goalId: string;
  goal: string;
  createdAt: IsoInstant;
  /** The first goal day. Days before it don't exist. */
  firstDay: DayKey;
  /** Sorted by fromDay; the first entry starts on firstDay. */
  checkInSchedule: ScheduleEntry[];
  morningTime: ClockTime;
  streak: number;
  /** Never decreases. Drives weapon unlocks. */
  bestStreak: number;
  /** Highest streak in the current run (since the streak was last 0). Gates milestone rewards. */
  runPeak: number;
  shields: number;
  bombs: number;
  consecutiveMissed: number;
  /** Latest day that is answered or missed. Days settle strictly in order. */
  lastSettledDay: DayKey | null;
  history: HistoryEntry[];
}

/** The answer window for one goal day (SPEC 2). */
export interface CheckInWindow {
  day: DayKey;
  tz: TimeZone;
  opensAt: Date;
  /** Morning reminder on day+1, or null when that time falls outside the window. */
  remindAt: Date | null;
  closesAt: Date;
}
