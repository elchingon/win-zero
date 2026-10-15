// Which one-time screen an answer or a run of missed days calls for.
import type { AnswerOutcome, GoalState, MissDigest } from '@/engine';

import type { Notice } from './types';

/** After a Not today. A Yes plays a round instead, so it has no notice. */
export function noticeForAnswer(outcome: AnswerOutcome, state: GoalState): Notice | null {
  switch (outcome.kind) {
    case 'yes':
      return null;
    case 'slipped':
      return outcome.lost > 0
        ? { kind: 'slipping', cause: 'answer', lost: outcome.lost, streak: outcome.streak, days: 1, stopped: false }
        : { kind: 'noted' };
    case 'shielded':
      return {
        kind: 'shielded',
        cause: 'answer',
        lost: 0,
        streak: outcome.streak,
        shieldsLeft: outcome.shieldsLeft,
        days: 1,
      };
    case 'reset':
      return outcome.lostStreak > 0
        ? {
            kind: 'reset',
            cause: 'answer',
            lostStreak: outcome.lostStreak,
            bestStreak: state.bestStreak,
            days: 1,
            stopped: false,
          }
        : { kind: 'noted' };
  }
}

/** On opening, after missed days. Days that cost nothing (the grace week, or paused) show nothing. */
export function noticeForMisses(digest: MissDigest | null, state: GoalState): Notice | null {
  if (!digest) return null;
  const { days, lost, stopped } = digest;
  if (digest.final === 'reset') {
    return { kind: 'reset', cause: 'missed', lostStreak: digest.streakBefore, bestStreak: state.bestStreak, days, stopped };
  }
  if (digest.final === 'shielded') {
    return { kind: 'shielded', cause: 'missed', lost, streak: state.streak, shieldsLeft: state.shields, days };
  }
  if (lost > 0) return { kind: 'slipping', cause: 'missed', lost, streak: state.streak, days, stopped };
  return null;
}
