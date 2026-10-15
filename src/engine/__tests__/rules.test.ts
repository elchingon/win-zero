// SPEC 3 table, row by row: first the reducers directly, then end to end through answer/resolve.
import { describe, expect, it } from '@jest/globals';

import { addDays } from '../dates';
import { answer, resolve, type AnswerOutcome } from '../resolve';
import { applyMissed, applyNotToday, applyYes, MISSED_GRACE_DAYS, SLIDE_FINAL } from '../rules';
import type { GoalState } from '../types';
import { at, answerDay, DAY0, DENVER, newGoal, notTodays, stateWith, yesDays } from './fixtures';

const ctx = { day: DAY0, at: at(DAY0, '21:00'), tz: DENVER };

describe('SPEC 3 reducers', () => {
  it('uses a 7-day grace and a 7-step slide', () => {
    expect(MISSED_GRACE_DAYS).toBe(7);
    expect(SLIDE_FINAL).toBe(7);
  });

  it('Yes: streak +1, best = max, clears the slide, misses and pause, recorded as yes', () => {
    const { state } = applyYes(
      stateWith({ streak: 4, bestStreak: 9, consecutiveMissed: 2, slide: 3, paused: true }),
      ctx,
    );
    expect(state).toMatchObject({ streak: 5, bestStreak: 9, consecutiveMissed: 0, slide: 0, paused: false });
    expect(state.lastSettledDay).toBe(DAY0);
    expect(state.history.at(-1)).toEqual({
      id: `g1:${DAY0}`,
      day: DAY0,
      result: 'yes',
      at: ctx.at.toISOString(),
      tz: DENVER,
      streakAfter: 5,
    });

    expect(applyYes(stateWith({ streak: 9, bestStreak: 9 }), ctx).state.bestStreak).toBe(10);
  });

  it('Not today: loses one zero and keeps the shields, recorded as no', () => {
    const r = applyNotToday(stateWith({ streak: 12, shields: 2, consecutiveMissed: 3, paused: true }), ctx);
    expect(r.lost).toBe(1);
    expect(r.slip).toMatchObject({ n: 1, final: null });
    expect(r.state).toMatchObject({ streak: 11, shields: 2, slide: 1, consecutiveMissed: 0, paused: false });
    expect(r.state.history.at(-1)).toMatchObject({ result: 'no', slip: 1, streakAfter: 11 });
    expect(r.state.history.at(-1)?.reset).toBeUndefined();
  });

  it('Not today #6 is still an ordinary slip', () => {
    const r = applyNotToday(stateWith({ streak: 15, slide: 5 }), ctx);
    expect(r.slip).toMatchObject({ n: 6, final: null });
    expect(r.state).toMatchObject({ streak: 14, slide: 6 });
  });

  it('the final Not today without a shield resets to 0 and starts the count over', () => {
    const r = applyNotToday(stateWith({ streak: 14, bestStreak: 20, runPeak: 20, slide: 6 }), ctx);
    expect(r.slip).toMatchObject({ n: 7, final: 'reset' });
    expect(r.lost).toBe(14);
    expect(r.state).toMatchObject({ streak: 0, bestStreak: 20, runPeak: 0, slide: 0 });
    expect(r.state.history.at(-1)).toMatchObject({ result: 'no', slip: 7, reset: true, streakAfter: 0 });
  });

  it('the final Not today with a shield spends it and keeps the streak', () => {
    const r = applyNotToday(stateWith({ streak: 14, runPeak: 20, slide: 6, shields: 2 }), ctx);
    expect(r.slip).toMatchObject({ n: 7, final: 'shielded' });
    expect(r.lost).toBe(0);
    expect(r.state).toMatchObject({ streak: 14, shields: 1, slide: 0, runPeak: 20 });
    expect(r.state.history.at(-1)).toMatchObject({ result: 'shielded', slip: 7, streakAfter: 14 });
    expect(r.state.history.at(-1)?.reset).toBeUndefined();
  });

  it('at streak 0 nothing is lost and no shield is spent, even on the final', () => {
    const one = applyNotToday(stateWith({ streak: 0, shields: 2 }), ctx);
    expect(one.lost).toBe(0);
    expect(one.state).toMatchObject({ streak: 0, slide: 1, shields: 2 });

    const final = applyNotToday(stateWith({ streak: 0, slide: 6, shields: 2 }), ctx);
    expect(final.slip.final).toBe('reset');
    expect(final.lost).toBe(0);
    expect(final.state).toMatchObject({ streak: 0, slide: 0, shields: 2 });
  });

  it('Missed #1–#7 in a row: grace, nothing lost and the slide untouched', () => {
    const r = applyMissed(stateWith({ streak: 10, consecutiveMissed: 2, slide: 3 }), ctx);
    expect(r).toMatchObject({ missedInRow: 3, grace: true, paused: false, slip: null });
    expect(r.state).toMatchObject({ streak: 10, slide: 3, consecutiveMissed: 3 });
    expect(r.state.history.at(-1)).toEqual({
      id: `g1:${DAY0}`,
      day: DAY0,
      result: 'missed',
      at: ctx.at.toISOString(),
      tz: DENVER,
      streakAfter: 10,
      missedInRow: 3,
    });

    const seventh = applyMissed(stateWith({ streak: 10, consecutiveMissed: 6 }), ctx);
    expect(seventh.grace).toBe(true);
    expect(seventh.state.streak).toBe(10);
  });

  it('Missed #8 counts as a slip', () => {
    const r = applyMissed(stateWith({ streak: 10, consecutiveMissed: 7 }), ctx);
    expect(r).toMatchObject({ missedInRow: 8, grace: false, slip: { n: 1, final: null } });
    expect(r.state).toMatchObject({ streak: 9, slide: 1, consecutiveMissed: 8, paused: false });
    expect(r.state.history.at(-1)).toMatchObject({ result: 'missed', missedInRow: 8, slip: 1, streakAfter: 9 });
  });

  it('shields never protect an ordinary missed slip', () => {
    const r = applyMissed(stateWith({ streak: 10, consecutiveMissed: 7, shields: 3 }), ctx);
    expect(r.state).toMatchObject({ streak: 9, shields: 3 });
  });

  it('a missed final with a shield spends it, keeps the streak and reminders, recorded as shielded', () => {
    const r = applyMissed(stateWith({ streak: 10, consecutiveMissed: 12, slide: 6, shields: 1 }), ctx);
    expect(r.slip).toMatchObject({ n: 7, final: 'shielded' });
    expect(r.state).toMatchObject({ streak: 10, shields: 0, slide: 0, paused: false, consecutiveMissed: 13 });
    expect(r.state.history.at(-1)).toMatchObject({ result: 'shielded', missedInRow: 13, slip: 7, streakAfter: 10 });
  });

  it('a missed final without a shield resets and pauses reminders; later misses count toward nothing', () => {
    const r = applyMissed(stateWith({ streak: 4, bestStreak: 20, consecutiveMissed: 12, slide: 6 }), ctx);
    expect(r.slip).toMatchObject({ n: 7, final: 'reset' });
    expect(r.state).toMatchObject({ streak: 0, bestStreak: 20, slide: 0, paused: true });
    expect(r.state.history.at(-1)).toMatchObject({ result: 'missed', missedInRow: 13, slip: 7, reset: true });

    const later = applyMissed(r.state, { ...ctx, day: addDays(DAY0, 1) });
    expect(later).toMatchObject({ missedInRow: 14, grace: false, paused: true, slip: null });
    expect(later.state).toMatchObject({ streak: 0, slide: 0, paused: true, consecutiveMissed: 14 });
    expect(later.state.history.at(-1)).toMatchObject({ result: 'missed', missedInRow: 14, paused: true });
    expect(later.state.history.at(-1)?.slip).toBeUndefined();
  });
});

function outcomesOf(state: GoalState, from: string, n: number): { state: GoalState; outcomes: AnswerOutcome[] } {
  let s = state;
  const outcomes: AnswerOutcome[] = [];
  for (let i = 0; i < n; i++) {
    const r = answerDay(s, addDays(from, i), 'not-today');
    s = r.state;
    outcomes.push(r.outcome);
  }
  return { state: s, outcomes };
}

describe('SPEC 3 end to end', () => {
  it('Yes plays a round with streak zeros', () => {
    const s = yesDays(newGoal(), DAY0, 3);
    const { outcome } = answerDay(s, '2026-10-16', 'yes');
    expect(outcome).toMatchObject({ kind: 'yes', day: '2026-10-16', streak: 4 });
  });

  it('Not today costs one zero, and the next Yes climbs from there', () => {
    const s = yesDays(newGoal(), DAY0, 3);
    const no = answerDay(s, '2026-10-16', 'not-today');
    expect(no.outcome).toEqual({ kind: 'slipped', day: '2026-10-16', streak: 2, slip: 1, lost: 1 });
    expect(answerDay(no.state, '2026-10-17', 'yes').outcome).toMatchObject({ kind: 'yes', streak: 3 });
  });

  it('seven Not todays in a row: six zeros lost, then the final resets', () => {
    const s = { ...yesDays(newGoal(), DAY0, 20), shields: 0 }; // through 11-01
    const { state, outcomes } = outcomesOf(s, '2026-11-02', 7);
    expect(outcomes.slice(0, 6).map((o) => o.kind === 'slipped' && [o.slip, o.streak])).toEqual([
      [1, 19],
      [2, 18],
      [3, 17],
      [4, 16],
      [5, 15],
      [6, 14],
    ]);
    expect(outcomes[6]).toEqual({ kind: 'reset', day: '2026-11-08', lostStreak: 14 });
    expect(state).toMatchObject({ streak: 0, bestStreak: 20, slide: 0, paused: false });
    expect(answerDay(state, '2026-11-09', 'yes').outcome).toMatchObject({ kind: 'yes', streak: 1 });
  });

  it('with a shield, the final is absorbed and the count starts over', () => {
    const s = yesDays(newGoal(), DAY0, 20); // shields at 7 and 14
    expect(s.shields).toBe(2);
    const { state, outcomes } = outcomesOf(s, '2026-11-02', 8);
    expect(outcomes[6]).toEqual({ kind: 'shielded', day: '2026-11-08', streak: 14, shieldsLeft: 1 });
    expect(outcomes[7]).toEqual({ kind: 'slipped', day: '2026-11-09', streak: 13, slip: 1, lost: 1 });
    expect(state.slide).toBe(1);
  });

  it('a Yes starts the count over', () => {
    let s = { ...yesDays(newGoal(), DAY0, 10), shields: 0 }; // through 10-22
    s = notTodays(s, '2026-10-23', 6);
    expect(s).toMatchObject({ streak: 4, slide: 6 });
    s = answerDay(s, '2026-10-29', 'yes').state;
    expect(s).toMatchObject({ streak: 5, slide: 0 });
    expect(answerDay(s, '2026-10-30', 'not-today').outcome).toMatchObject({ kind: 'slipped', slip: 1, streak: 4 });
  });

  it('the first seven missed days cost nothing; the 8th loses a zero', () => {
    const s = yesDays(newGoal(), DAY0, 10); // through 10-22
    const week = resolve(s, at('2026-10-31', '00:30'), DENVER); // 10-23 .. 10-29 closed
    expect(week.events).toHaveLength(7);
    expect(week.events.every((e) => e.grace && e.streakAfter === 10)).toBe(true);
    expect(week.state).toMatchObject({ streak: 10, consecutiveMissed: 7, slide: 0 });

    const eighth = resolve(week.state, at('2026-11-01', '00:30'), DENVER);
    expect(eighth.events).toEqual([
      {
        type: 'missed',
        day: '2026-10-30',
        streakBefore: 10,
        streakAfter: 9,
        missedInRow: 8,
        grace: false,
        slip: 1,
        final: null,
        paused: false,
      },
    ]);
  });

  it('counts the slide since the last Yes: Not todays, then misses past the grace', () => {
    let s = { ...yesDays(newGoal(), DAY0, 10), shields: 0 }; // through 10-22
    s = notTodays(s, '2026-10-23', 5); // 10-23 .. 10-27
    expect(s).toMatchObject({ streak: 5, slide: 5 });
    const { state, events } = resolve(s, at('2026-11-07', '00:00'), DENVER); // 10-28 .. 11-05 closed
    expect(events.map((e) => [e.day, e.grace, e.slip, e.final, e.streakAfter])).toEqual([
      ['2026-10-28', true, null, null, 5],
      ['2026-10-29', true, null, null, 5],
      ['2026-10-30', true, null, null, 5],
      ['2026-10-31', true, null, null, 5],
      ['2026-11-01', true, null, null, 5],
      ['2026-11-02', true, null, null, 5],
      ['2026-11-03', true, null, null, 5],
      ['2026-11-04', false, 6, null, 4],
      ['2026-11-05', false, 7, 'reset', 0],
    ]);
    expect(state).toMatchObject({ streak: 0, slide: 0, paused: true, consecutiveMissed: 9 });
  });

  it('20 → seven free misses → six slips to 14 → the 14th miss resets to 0 at midnight', () => {
    const s = { ...yesDays(newGoal(), DAY0, 20), shields: 0 }; // last answered 11-01
    const before = resolve(s, at('2026-11-16', '23:59'), DENVER); // 11-02 .. 11-14 closed
    expect(before.events).toHaveLength(13);
    expect(before.state).toMatchObject({ streak: 14, consecutiveMissed: 13, slide: 6, paused: false });

    const final = resolve(before.state, at('2026-11-17', '00:00'), DENVER);
    expect(final.events).toEqual([
      {
        type: 'missed',
        day: '2026-11-15',
        streakBefore: 14,
        streakAfter: 0,
        missedInRow: 14,
        grace: false,
        slip: 7,
        final: 'reset',
        paused: false,
      },
    ]);
    expect(final.state).toMatchObject({ streak: 0, bestStreak: 20, paused: true });
  });

  it('every kind of answer clears consecutiveMissed and the pause', () => {
    const s = { ...yesDays(newGoal(), DAY0, 20), shields: 0 };
    const base = resolve(s, at('2026-11-18', '00:30'), DENVER).state; // reset on 11-15, 11-16 paused
    expect(base).toMatchObject({ paused: true, consecutiveMissed: 15 });
    for (const ans of ['yes', 'not-today'] as const) {
      const r = answer(base, { answer: ans }, at('2026-11-18', '00:30'), DENVER);
      expect(r.ok && r.state).toMatchObject({ consecutiveMissed: 0, paused: false });
    }
  });

  it('bestStreak never decreases', () => {
    let s = yesDays(newGoal(), DAY0, 5);
    s = notTodays(s, '2026-10-18', 5);
    s = resolve(s, at('2026-11-30', '21:00'), DENVER).state;
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(5);
  });
});
