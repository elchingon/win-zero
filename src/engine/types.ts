/** Local calendar date of a goal day, 'YYYY-MM-DD'. */
export type DayKey = string;
/** Wall-clock time, 24h 'HH:mm'. */
export type ClockTime = string;
/** IANA time zone name, e.g. 'America/Denver'. */
export type TimeZone = string;
/** 0 = Sunday … 6 = Saturday, as `weekdayOf` gives. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** ISO-8601 instant in UTC, e.g. '2026-10-14T02:00:00.000Z'. */
export type IsoInstant = string;

/**
 * Check-in time in force from `fromDay` until the next entry. A new entry is appended when
 * the user edits the time or the days, or the device changes time zone (see resolve.ts).
 */
export interface ScheduleEntry {
  fromDay: DayKey;
  time: ClockTime;
  tz: TimeZone;
  /**
   * The weekdays with a check-in, sorted, at least one (SPEC 9). Absent means every day, the only
   * choice in the free app; the other days are rest days, with no window and no effect.
   */
  days?: Weekday[];
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
  /** Days with no answer (missed, or shielded after a miss): consecutive misses including this one. */
  missedInRow?: number;
  /** The day counted as slip 1–7 since the last Yes: a Not today, or a miss past the grace days. */
  slip?: number;
  /** The final slip found no shield to spend, so the streak reset to 0. */
  reset?: true;
  /** A miss after a missed-day reset. It counts toward nothing. */
  paused?: true;
}

export interface GoalState {
  version: 1;
  goalId: string;
  goal: string;
  /**
   * A short name for the lock screen (SPEC 9): with "Goal in reminders" off and more than one goal,
   * reminders name the goal by it instead of its wording. Optional; absent when there's none.
   */
  alias?: string;
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
  /** Missed days in a row. Any answer clears it. */
  consecutiveMissed: number;
  /** Slips since the last Yes or the last final (SPEC 3). The SLIDE_FINAL-th slip is the final. */
  slide: number;
  /** A run of missed days reached a reset: daily reminders stop until the next answer. */
  paused: boolean;
  /** Latest day that is answered or missed. Days settle strictly in order. */
  lastSettledDay: DayKey | null;
  history: HistoryEntry[];
}

/** The answer window for one goal day (SPEC 2). */
export interface CheckInWindow {
  day: DayKey;
  tz: TimeZone;
  opensAt: Date;
  /**
   * The reminder: the next time the clock reads the reminder time after the window opens (later
   * on `day`, or on day+1). Null when that comes with or after day+1's check-in, which serves as
   * the reminder, or outside the window.
   */
  remindAt: Date | null;
  closesAt: Date;
}
