// Comebacks (SPEC 9): a Yes after COMEBACK_MIN_GAP or more check-in days without one, read from history.
import { describe, expect, it } from '@jest/globals';

import {
  cameBackAfterReset,
  comebackAt,
  comebackCount,
  comebacks,
  COMEBACK_MIN_GAP,
  WIN_BACK_MIN_ZEROS,
  winBackSize,
} from '../comeback';
import { BONUS_MAX_N } from '../credits';
import { addDays } from '../dates';
import { createGoalWithHeadStart } from '../headStart';
import { answer, resolve } from '../resolve';
import type { GoalState } from '../types';
import { answerDay, at, DAY0, DENVER, newGoal, notTodays, TOKYO, yesDays } from './fixtures';

const MON_WED_FRI = [1, 3, 5];

/** Yes on `day` after the days before it went unanswered: answered late, once they've closed. */
function yesAfterMisses(s: GoalState, day: string, tz = DENVER): GoalState {
  return answerDay(s, day, 'yes', { timeDay: addDays(day, 1), tz }).state;
}

describe('comebackAt', () => {
  it('needs a gap of COMEBACK_MIN_GAP check-ins', () => {
    expect(COMEBACK_MIN_GAP).toBe(3);
    const five = yesDays(newGoal(), DAY0, 5); // through 10-17
    const two = answerDay(notTodays(five, '2026-10-18', 2), '2026-10-20', 'yes').state;
    expect(comebackAt(two)).toBeNull();
    const three = answerDay(notTodays(five, '2026-10-18', 3), '2026-10-21', 'yes').state;
    expect(comebackAt(three)).toEqual({ day: '2026-10-21', gap: 3, before: 5, reset: false, lost: 3 });
  });

  it('is only ever the Yes itself', () => {
    const s = notTodays(yesDays(newGoal(), DAY0, 5), '2026-10-18', 4);
    expect(comebackAt(s)).toBeNull();
    expect(comebackAt(yesDays(newGoal(), DAY0, 9))).toBeNull();
  });

  it('counts a week of free missed days, which cost nothing', () => {
    const s = yesAfterMisses(yesDays(newGoal(), DAY0, 4), '2026-10-24'); // 10-17 .. 10-23 missed
    expect(comebackAt(s)).toEqual({ day: '2026-10-24', gap: 7, before: 4, reset: false, lost: 0 });
  });

  it('counts a shielded day, and keeps what the shield saved', () => {
    // A shield, then 14 missed days: 7 free, 6 slips, and the final taken by the shield.
    const s = yesAfterMisses(yesDays(newGoal(), DAY0, 7), '2026-11-03');
    expect(s.history.at(-2)?.result).toBe('shielded');
    expect(comebackAt(s)).toEqual({ day: '2026-11-03', gap: 14, before: 7, reset: false, lost: 6 });
  });

  it('notes a reset, and keeps counting the paused days after it, across the fall-back change', () => {
    // 10-17 .. 11-05 missed (Nov 1 among them): the 14th miss, 10-30, resets with no shield.
    const s = yesAfterMisses(yesDays(newGoal(), DAY0, 4), '2026-11-06');
    expect(s.history.find((e) => e.reset)?.day).toBe('2026-10-30');
    expect(s.history.at(-2)?.paused).toBe(true);
    expect(comebackAt(s)).toEqual({ day: '2026-11-06', gap: 20, before: 4, reset: true, lost: 4 });
  });

  it('notes a reset that seven Not todays reach', () => {
    const s = answerDay(notTodays(yesDays(newGoal(), DAY0, 3), '2026-10-16', 7), '2026-10-23', 'yes').state;
    expect(comebackAt(s)).toMatchObject({ gap: 7, before: 3, reset: true, lost: 3 });
  });

  it('needs a Yes before the gap', () => {
    const s = answerDay(notTodays(newGoal(), DAY0, 5), '2026-10-18', 'yes').state;
    expect(comebackAt(s)).toBeNull();
    const fresh = yesAfterMisses(resolve(newGoal(), at('2026-10-30', '12:00'), DENVER).state, '2026-10-29');
    expect(fresh.history.some((e) => e.reset)).toBe(true);
    expect(comebackAt(fresh)).toBeNull();
    expect(cameBackAfterReset(fresh)).toBe(false);
  });

  it("counts a head start's Yes before the gap, never a head start day as the comeback", () => {
    const start = createGoalWithHeadStart({ goalId: 'g1', goal: 'Stop drinking', now: at(DAY0, '12:00'), tz: DENVER, headStart: 10 });
    expect(comebackAt(start)).toBeNull();
    const s = answerDay(notTodays(start, DAY0, 3), '2026-10-16', 'yes').state;
    expect(comebackAt(s)).toEqual({ day: '2026-10-16', gap: 3, before: 10, reset: false, lost: 3 });
  });

  it('counts check-in days only on a weekday schedule', () => {
    // Monday, Wednesday and Friday; DAY0 is a Tuesday, so the first check-in is Wednesday 10-14.
    let s = answerDay(newGoal({ days: MON_WED_FRI }), '2026-10-14', 'yes').state;
    s = answerDay(s, '2026-10-16', 'yes').state;
    expect(comebackAt(answerDay(s, '2026-10-19', 'yes').state)).toBeNull(); // over a weekend
    // 10-19, 10-21 and 10-23 go unanswered: three check-ins across a week.
    s = yesAfterMisses(s, '2026-10-26');
    expect(comebackAt(s)).toMatchObject({ gap: 3, before: 2, reset: false });
  });

  it('works through a trip in the middle of the gap', () => {
    let s = yesDays(newGoal(), DAY0, 3); // Denver, through 10-15
    s = notTodays(s, '2026-10-16', 2);
    // In Tokyo now: 10-18 is left unanswered, and 10-19 is answered there.
    const r = answer(s, { answer: 'yes', day: '2026-10-19' }, at('2026-10-20', '21:00', TOKYO), TOKYO);
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.history.at(-2)?.result).toBe('missed');
    expect(comebackAt(r.state)).toMatchObject({ day: '2026-10-19', gap: 3, before: 3, reset: false });
  });
});

describe('comebacks over a goal', () => {
  it('counts every comeback, and the ones after a reset', () => {
    let s = yesDays(newGoal(), DAY0, 3); // 10-13 .. 10-15
    s = answerDay(notTodays(s, '2026-10-16', 3), '2026-10-19', 'yes').state; // comeback
    s = answerDay(notTodays(s, '2026-10-20', 7), '2026-10-27', 'yes').state; // comeback, after a reset
    expect(comebacks(s).map((c) => [c.day, c.reset])).toEqual([
      ['2026-10-19', false],
      ['2026-10-27', true],
    ]);
    expect(comebackCount(s)).toBe(2);
    expect(cameBackAfterReset(s)).toBe(true);
    expect(cameBackAfterReset(yesDays(newGoal(), DAY0, 3))).toBe(false);
  });
});

describe('winBackSize', () => {
  it('is the streak before the gap, at least WIN_BACK_MIN_ZEROS', () => {
    const c = { day: DAY0, gap: 3, reset: false, lost: 0 };
    expect(winBackSize({ ...c, before: 2 })).toBe(WIN_BACK_MIN_ZEROS);
    expect(winBackSize({ ...c, before: 40 })).toBe(40);
    expect(winBackSize({ ...c, before: BONUS_MAX_N + 5 })).toBe(BONUS_MAX_N);
  });
});
