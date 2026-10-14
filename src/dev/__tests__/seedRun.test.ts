// The debug "Jump to day N" rebuild: real Yes answers, back-dated, leaving today's window open.
import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  answer,
  currentCheckInTime,
  pendingWindow,
  resolve,
  SHIELD_CAP,
  type GoalState,
  type TimeZone,
} from '@/engine';
import { at, DAY0, DENVER, newGoal, notTodays, TOKYO, yesDays } from '@/engine/__tests__/fixtures';

import { openDayAt, SEED_MAX_N, seedYesRun } from '../seedRun';

/** Seed a run of `n`, then answer Yes at `now` as the Jump button does. */
function jump(state: GoalState, n: number, now: Date, tz: TimeZone = DENVER) {
  const seeded = seedYesRun(state, n, now, tz);
  const r = answer(seeded, { answer: 'yes' }, now, tz);
  if (!r.ok || r.outcome.kind !== 'yes') throw new Error('Yes after seeding was rejected');
  return { seeded, state: r.state, outcome: r.outcome };
}

describe('openDayAt', () => {
  it('is today once check-in time has passed', () => {
    expect(openDayAt(newGoal(), at(DAY0, '20:00'), DENVER)).toBe(DAY0);
    expect(openDayAt(newGoal(), at(DAY0, '23:59'), DENVER)).toBe(DAY0);
  });

  it('is yesterday before check-in time', () => {
    expect(openDayAt(newGoal(), at(DAY0, '19:59'), DENVER)).toBe(addDays(DAY0, -1));
    expect(openDayAt(newGoal(), at(DAY0, '00:30'), DENVER)).toBe(addDays(DAY0, -1));
  });
});

describe('seedYesRun', () => {
  it('leaves n - 1 consecutive Yes days and the window at now open', () => {
    const now = at(DAY0, '21:00');
    const seeded = seedYesRun(newGoal(), 7, now, DENVER);
    expect(seeded.streak).toBe(6);
    expect(seeded.history.map((h) => h.result)).toEqual(Array(6).fill('yes'));
    expect(seeded.history.map((h) => h.day)).toEqual([6, 5, 4, 3, 2, 1].map((k) => addDays(DAY0, -k)));
    expect(seeded.lastSettledDay).toBe(addDays(DAY0, -1));
    expect(pendingWindow(seeded, now)?.day).toBe(DAY0);
  });

  it("answers yesterday's window when run before check-in time", () => {
    const now = at(DAY0, '10:00');
    const { seeded, outcome } = jump(newGoal(), 3, now);
    expect(pendingWindow(seeded, now)?.day).toBe(addDays(DAY0, -1));
    expect(outcome.day).toBe(addDays(DAY0, -1));
    expect(outcome.streak).toBe(3);
  });

  it('gives Day 1 an empty history with the window open', () => {
    const now = at(DAY0, '21:00');
    const { seeded, state } = jump(newGoal(), 1, now);
    expect(seeded.history).toEqual([]);
    expect(seeded.firstDay).toBe(DAY0);
    expect(state.streak).toBe(1);
  });

  it('earns what a real run earns: Day 7', () => {
    const { state, outcome } = jump(newGoal(), 7, at(DAY0, '21:00'));
    expect(state).toMatchObject({ streak: 7, bestStreak: 7, runPeak: 7, bombs: 1, shields: 1, slide: 0 });
    expect(outcome.rewards.shield).toBe(true);
    expect(outcome.rewards.weapons.map((w) => w.id)).toEqual(['scatter']);
  });

  it('earns what a real run earns: Day 30 across the fall-back change', () => {
    const now = at('2026-11-10', '21:00'); // US DST ended on 11-01, inside the run
    const { seeded, state, outcome } = jump(newGoal(), 30, now);
    expect(seeded.history).toHaveLength(29);
    expect(seeded.history.every((h) => h.result === 'yes')).toBe(true);
    expect(state).toMatchObject({ streak: 30, bestStreak: 30, bombs: 6, shields: SHIELD_CAP });
    expect(outcome.rewards.bomb).toBe(true);
    expect(outcome.rewards.weapons.map((w) => w.id)).toEqual(['chain']);
  });

  it('earns what a real run earns: Day 100', () => {
    const { state, outcome } = jump(newGoal(), 100, at(DAY0, '21:00'));
    expect(state).toMatchObject({ streak: 100, bestStreak: 100, bombs: 20, shields: SHIELD_CAP });
    expect(outcome.rewards.weapons.map((w) => w.id)).toEqual(['nuke']);
  });

  it('works in another zone', () => {
    const now = at(DAY0, '21:00', TOKYO);
    const { state, outcome } = jump(newGoal({ tz: TOKYO }), 14, now, TOKYO);
    expect(outcome.day).toBe(DAY0);
    expect(state.streak).toBe(14);
    expect(state.history.every((h) => h.tz === TOKYO)).toBe(true);
  });

  it('keeps the goal wording, times and id', () => {
    const goal = newGoal({ checkInTime: '21:30', morningTime: '08:00' });
    const seeded = seedYesRun(goal, 10, at(DAY0, '22:00'), DENVER);
    expect(seeded.goalId).toBe(goal.goalId);
    expect(seeded.goal).toBe(goal.goal);
    expect(currentCheckInTime(seeded)).toBe('21:30');
    expect(seeded.morningTime).toBe('08:00');
  });

  it('replaces a messy history and counters', () => {
    const start = notTodays(yesDays(newGoal(), DAY0, 5), addDays(DAY0, 5), 3);
    const now = at(addDays(DAY0, 20), '21:00');
    const seeded = seedYesRun(start, 5, now, DENVER);
    expect(seeded).toMatchObject({ streak: 4, slide: 0, consecutiveMissed: 0, paused: false, bombs: 0 });
    expect(seeded.history.every((h) => h.result === 'yes')).toBe(true);
  });

  it('is already resolved at now', () => {
    const now = at(DAY0, '21:00');
    const seeded = seedYesRun(newGoal(), 30, now, DENVER);
    const r = resolve(seeded, now, DENVER);
    expect(r.events).toEqual([]);
    expect(r.state).toEqual(seeded);
  });

  it('rejects run lengths it cannot build', () => {
    const now = at(DAY0, '21:00');
    for (const n of [0, -1, 1.5, Number.NaN, SEED_MAX_N + 1]) {
      expect(() => seedYesRun(newGoal(), n, now, DENVER)).toThrow(RangeError);
    }
  });
});
