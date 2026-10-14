// SPEC 3 table, row by row: first the reducers directly, then end to end through answer/resolve.
import { describe, expect, it } from '@jest/globals';

import { addDays } from '../dates';
import { answer, resolve } from '../resolve';
import { applyMissed, applyNotToday, applyYes, MISSES_UNTIL_RESET } from '../rules';
import { at, answerDay, DAY0, DENVER, newGoal, stateWith, yesDays } from './fixtures';

const ctx = { day: DAY0, at: at(DAY0, '21:00'), tz: DENVER };

describe('SPEC 3 reducers', () => {
  it('Yes: streak +1, best = max, consecutiveMissed = 0, recorded as yes', () => {
    const { state } = applyYes(stateWith({ streak: 4, bestStreak: 9, consecutiveMissed: 2 }), ctx);
    expect(state.streak).toBe(5);
    expect(state.bestStreak).toBe(9);
    expect(state.consecutiveMissed).toBe(0);
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

  it('Not today with a shield: spends it, keeps the streak, recorded as shielded', () => {
    const r = applyNotToday(stateWith({ streak: 12, shields: 2, consecutiveMissed: 3 }), ctx);
    expect(r.shielded).toBe(true);
    expect(r.state.streak).toBe(12);
    expect(r.state.shields).toBe(1);
    expect(r.state.consecutiveMissed).toBe(0);
    expect(r.state.history.at(-1)).toMatchObject({ result: 'shielded', streakAfter: 12 });
  });

  it('Not today without a shield: streak back to 0, recorded as no', () => {
    const r = applyNotToday(stateWith({ streak: 12, bestStreak: 12, runPeak: 12, consecutiveMissed: 3 }), ctx);
    expect(r.shielded).toBe(false);
    expect(r.lostStreak).toBe(12);
    expect(r.state.streak).toBe(0);
    expect(r.state.runPeak).toBe(0);
    expect(r.state.bestStreak).toBe(12);
    expect(r.state.consecutiveMissed).toBe(0);
    expect(r.state.history.at(-1)).toMatchObject({ result: 'no', streakAfter: 0 });
  });

  it('Not today at streak 0 keeps the shields (nothing to protect)', () => {
    const r = applyNotToday(stateWith({ streak: 0, shields: 2 }), ctx);
    expect(r.shielded).toBe(false);
    expect(r.state.shields).toBe(2);
    expect(r.state.history.at(-1)).toMatchObject({ result: 'no' });
  });

  it('Missed: consecutiveMissed +1, lose one zero, recorded as missed', () => {
    const r = applyMissed(stateWith({ streak: 10, consecutiveMissed: 2 }), ctx);
    expect(r.state.streak).toBe(9);
    expect(r.state.consecutiveMissed).toBe(3);
    expect(r.missedInRow).toBe(3);
    expect(r.reset).toBe(false);
    expect(r.state.history.at(-1)).toMatchObject({ result: 'missed', missedInRow: 3, streakAfter: 9 });
    expect(r.state.history.at(-1)?.reset).toBeUndefined();
  });

  it('Missed at streak 0 stays at 0 and still counts toward the cutoff', () => {
    const r = applyMissed(stateWith({ streak: 0, consecutiveMissed: 5 }), ctx);
    expect(r.state.streak).toBe(0);
    expect(r.state.consecutiveMissed).toBe(6);
  });

  it('Shields never protect a missed day', () => {
    const r = applyMissed(stateWith({ streak: 10, shields: 3 }), ctx);
    expect(r.state.shields).toBe(3);
    expect(r.state.streak).toBe(9);
  });

  it('7th consecutive missed day: full reset to 0', () => {
    const r = applyMissed(stateWith({ streak: 14, bestStreak: 20, consecutiveMissed: 6 }), ctx);
    expect(MISSES_UNTIL_RESET).toBe(7);
    expect(r.reset).toBe(true);
    expect(r.state.streak).toBe(0);
    expect(r.state.bestStreak).toBe(20);
    expect(r.state.history.at(-1)).toMatchObject({ result: 'missed', missedInRow: 7, reset: true, streakAfter: 0 });

    const eighth = applyMissed(r.state, { ...ctx, day: addDays(DAY0, 1) });
    expect(eighth.reset).toBe(false);
    expect(eighth.state.consecutiveMissed).toBe(8);
  });
});

describe('SPEC 3 end to end', () => {
  it('Yes plays a round with streak zeros', () => {
    const s = yesDays(newGoal(), DAY0, 3);
    const { outcome } = answerDay(s, '2026-10-16', 'yes');
    expect(outcome).toMatchObject({ kind: 'yes', day: '2026-10-16', streak: 4 });
  });

  it('Not today resets, so the next Yes plays 1 zero', () => {
    let s = yesDays(newGoal(), DAY0, 3);
    const no = answerDay(s, '2026-10-16', 'not-today');
    expect(no.outcome).toEqual({ kind: 'reset', day: '2026-10-16', lostStreak: 3 });
    s = no.state;
    expect(answerDay(s, '2026-10-17', 'yes').outcome).toMatchObject({ kind: 'yes', streak: 1 });
  });

  it('Not today with a shield is absorbed', () => {
    const s = yesDays(newGoal(), DAY0, 7); // the 7th Yes earns a shield
    expect(s.shields).toBe(1);
    const r = answerDay(s, '2026-10-20', 'not-today');
    expect(r.outcome).toEqual({ kind: 'shielded', day: '2026-10-20', streak: 7, shieldsLeft: 0 });
    expect(answerDay(r.state, '2026-10-21', 'yes').outcome).toMatchObject({ streak: 8 });
  });

  it('loses one zero per missed day', () => {
    const s = yesDays(newGoal(), DAY0, 10); // streak 10, last answered 10-22
    const { state, events } = resolve(s, at('2026-10-26', '20:30'), DENVER); // 10-23..10-25 closed
    expect(events.map((e) => [e.day, e.streakAfter])).toEqual([
      ['2026-10-23', 9],
      ['2026-10-24', 8],
      ['2026-10-25', 7],
    ]);
    expect(state.streak).toBe(7);
    expect(state.consecutiveMissed).toBe(3);
  });

  it('20 → six misses → 14 → the 7th miss resets to 0', () => {
    const s = yesDays(newGoal(), DAY0, 20); // last answered 11-01
    const six = resolve(s, at('2026-11-09', '19:59'), DENVER); // 11-02..11-07 closed
    expect(six.state.streak).toBe(14);
    expect(six.state.consecutiveMissed).toBe(6);
    const seven = resolve(six.state, at('2026-11-09', '20:00'), DENVER);
    expect(seven.events).toEqual([
      { type: 'missed', day: '2026-11-08', streakBefore: 14, streakAfter: 0, missedInRow: 7, reset: true },
    ]);
    expect(seven.state.streak).toBe(0);
    expect(seven.state.bestStreak).toBe(20);
  });

  it('every kind of answer clears consecutiveMissed', () => {
    const base = resolve(yesDays(newGoal(), DAY0, 8), at('2026-10-24', '20:30'), DENVER).state; // 10-21..10-23 missed
    expect(base.consecutiveMissed).toBe(3);
    expect(base.shields).toBe(1);
    for (const ans of ['yes', 'not-today'] as const) {
      const r = answer(base, { answer: ans }, at('2026-10-24', '21:00'), DENVER);
      expect(r.ok && r.state.consecutiveMissed).toBe(0);
    }
    const noShield = { ...base, shields: 0 };
    const r = answer(noShield, { answer: 'not-today' }, at('2026-10-24', '21:00'), DENVER);
    expect(r.ok && r.state.consecutiveMissed).toBe(0);
  });

  it('bestStreak never decreases', () => {
    let s = yesDays(newGoal(), DAY0, 5);
    s = answerDay(s, '2026-10-18', 'not-today').state;
    s = resolve(s, at('2026-10-30', '21:00'), DENVER).state;
    expect(s.streak).toBe(0);
    expect(s.bestStreak).toBe(5);
  });
});
