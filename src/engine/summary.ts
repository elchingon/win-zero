// Read-only summaries of a goal for the screens, so the UI never re-derives the rules.
import { isGoalDay } from './goalDays';
import { slip, SLIDE_FINAL, type Final } from './rules';
import type { DayKey, DayResult, GoalState, HistoryEntry } from './types';

export interface MissDigest {
  /** Days with no answer since `seenThrough`, including any a shield saved. */
  days: number;
  /** Zeros those days cost. */
  lost: number;
  /** The latest final among them that had a streak to lose or protect. */
  final: Final | null;
  /** The streak before the first of those days. */
  streakBefore: number;
  streak: number;
  /** A Yes came after the last of those days, so the slide has stopped. */
  stopped: boolean;
}

/**
 * What happened on days nobody answered, after `seenThrough` (exclusive; null means all of
 * history). Null when there were none. Answered days only move the running streak, and a Yes
 * after the last of them stops the slide.
 */
export function missDigest(state: GoalState, seenThrough: DayKey | null): MissDigest | null {
  let prev = 0;
  let digest: MissDigest | null = null;
  for (const e of state.history) {
    if (e.missedInRow !== undefined && (seenThrough === null || e.day > seenThrough)) {
      digest ??= { days: 0, lost: 0, final: null, streakBefore: prev, streak: state.streak, stopped: false };
      digest.days += 1;
      digest.stopped = false;
      digest.lost += Math.max(0, prev - e.streakAfter);
      if (e.slip === SLIDE_FINAL && prev > 0) digest.final = e.reset ? 'reset' : 'shielded';
    } else if (digest && e.result === 'yes') {
      digest.stopped = true;
    }
    prev = e.streakAfter;
  }
  return digest;
}

/** The days history has settled, for `isRestDay` across a calendar month. */
export function settledDays(state: GoalState): Set<DayKey> {
  return new Set(state.history.map((e) => e.day));
}

/**
 * True when `day` is a rest day: not a check-in day (SPEC 9). Up to the last settled day, history
 * decides, since it keeps every check-in day even after old schedule entries are pruned: a day there
 * with no entry was a rest day. Later days follow the schedule. Days before the goal began are
 * neither. Pass `settled` (from `settledDays`) when asking about many days.
 */
export function isRestDay(state: GoalState, day: DayKey, settled: ReadonlySet<DayKey> = settledDays(state)): boolean {
  if (day < state.firstDay) return false;
  if (state.lastSettledDay !== null && day <= state.lastSettledDay) return !settled.has(day);
  return !isGoalDay(state, day);
}

export type CalendarMark = DayResult | 'paused';

/** How a settled day shows on the history calendar. Misses after a missed-day reset are muted. */
export function calendarMark(entry: HistoryEntry): CalendarMark {
  return entry.result === 'missed' && entry.paused ? 'paused' : entry.result;
}

export type NotTodayPreview =
  | { kind: 'slip'; lose: number }
  | { kind: 'shield' }
  | { kind: 'reset'; lose: number };

/** What answering Not today would do right now, for the check-in card's stakes line. */
export function notTodayPreview(state: GoalState): NotTodayPreview {
  const s = slip(state);
  if (s.final === 'shielded') return { kind: 'shield' };
  if (s.final === 'reset') return { kind: 'reset', lose: state.streak };
  return { kind: 'slip', lose: state.streak - s.streak };
}

export interface HistoryStats {
  /** Every day answered Yes. */
  yesDays: number;
  /** Days answered Yes in the month `today` falls in. */
  yesThisMonth: number;
  /**
   * The most recent run that reached the best streak: from its first Yes to the Yes that set
   * the best. A run lasts while the streak stays above 0, so slips inside it widen the dates.
   * Null before the first Yes, or if history doesn't show the best (data from elsewhere).
   */
  bestRun: { from: DayKey; to: DayKey } | null;
}

/** Counts from the history the goal already keeps, for Home's stats. */
export function historyStats(state: GoalState, today: DayKey): HistoryStats {
  const { history, bestStreak } = state;
  const month = today.slice(0, 7); // 'YYYY-MM'
  let yesDays = 0;
  let yesThisMonth = 0;
  let peak = -1;
  history.forEach((e, i) => {
    if (e.result !== 'yes') return;
    yesDays++;
    if (e.day.startsWith(month)) yesThisMonth++;
    if (bestStreak > 0 && e.streakAfter === bestStreak) peak = i;
  });

  let bestRun: HistoryStats['bestRun'] = null;
  const to = history[peak];
  if (to) {
    let start = peak;
    for (let i = peak - 1; i >= 0 && (history[i]?.streakAfter ?? 0) > 0; i--) start = i;
    const first = history.slice(start, peak + 1).find((e) => e.result === 'yes');
    if (first) bestRun = { from: first.day, to: to.day };
  }
  return { yesDays, yesThisMonth, bestRun };
}
