// Read-only summaries of a goal for the screens, so the UI never re-derives the rules.
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
}

/**
 * What happened on days nobody answered, after `seenThrough` (exclusive; null means all of
 * history). Null when there were none. Answered days only move the running streak.
 */
export function missDigest(state: GoalState, seenThrough: DayKey | null): MissDigest | null {
  let prev = 0;
  let digest: MissDigest | null = null;
  for (const e of state.history) {
    if (e.missedInRow !== undefined && (seenThrough === null || e.day > seenThrough)) {
      digest ??= { days: 0, lost: 0, final: null, streakBefore: prev, streak: state.streak };
      digest.days += 1;
      digest.lost += Math.max(0, prev - e.streakAfter);
      if (e.slip === SLIDE_FINAL && prev > 0) digest.final = e.reset ? 'reset' : 'shielded';
    }
    prev = e.streakAfter;
  }
  return digest;
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
