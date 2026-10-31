import { describe, expect, it } from '@jest/globals';

import { CELEBRATIONS, celebrationFor, THIRTY_DAY_MARK } from '../celebrations';
import { addDays } from '../dates';
import { BOMB_EVERY, SHIELD_CAP, SHIELD_EVERY } from '../rewards';
import type { DayKey, GoalState, TimeZone } from '../types';
import { answerDay, DAY0, DENVER, newGoal, notTodays, TOKYO, yesDays } from './fixtures';

/** The Yes on `day`, and the celebration its round earns. */
function yesOn(state: GoalState, day: DayKey, tz: TimeZone = DENVER) {
  const { state: after, outcome } = answerDay(state, day, 'yes', { tz });
  if (outcome.kind !== 'yes') throw new Error('Expected a Yes');
  return { state: after, celebration: celebrationFor({ n: after.streak, rewards: outcome.rewards }) };
}

describe('the celebrations table (SPEC 6)', () => {
  it('has one entry per id and per day, in order', () => {
    expect(new Set(CELEBRATIONS.map((c) => c.id)).size).toBe(CELEBRATIONS.length);
    expect(new Set(CELEBRATIONS.map((c) => c.day)).size).toBe(CELEBRATIONS.length);
    expect(CELEBRATIONS.map((c) => c.day)).toEqual([SHIELD_EVERY, THIRTY_DAY_MARK]);
  });

  it('rests each one on a reward its day really pays', () => {
    expect(THIRTY_DAY_MARK % BOMB_EVERY).toBe(0);
    for (const { id, day } of CELEBRATIONS) {
      const before = yesDays(newGoal(), DAY0, day - 1);
      expect(yesOn(before, addDays(DAY0, day - 1)).celebration?.id).toBe(id);
    }
  });

  it('celebrates no other day', () => {
    let s = newGoal();
    const hits: number[] = [];
    for (let i = 0; i < 40; i++) {
      const r = yesOn(s, addDays(DAY0, i));
      s = r.state;
      if (r.celebration) hits.push(s.streak);
    }
    expect(hits).toEqual([SHIELD_EVERY, THIRTY_DAY_MARK]);
  });
});

describe('a real arrival, not a climb back', () => {
  it('is not due again when a slip and a Yes come back to the same day in a run', () => {
    let s = yesDays(newGoal(), DAY0, SHIELD_EVERY);
    s = notTodays(s, addDays(DAY0, SHIELD_EVERY), 1);
    expect(s.streak).toBe(SHIELD_EVERY - 1);
    expect(yesOn(s, addDays(DAY0, SHIELD_EVERY + 1)).celebration).toBeNull();

    s = yesDays(newGoal(), DAY0, THIRTY_DAY_MARK);
    s = notTodays(s, addDays(DAY0, THIRTY_DAY_MARK), 1);
    expect(yesOn(s, addDays(DAY0, THIRTY_DAY_MARK + 1)).celebration).toBeNull();
  });

  it('is due again on a new run, after 7 slips in a row reset the streak', () => {
    let s = { ...yesDays(newGoal(), DAY0, SHIELD_EVERY), shields: 0 };
    let day = addDays(DAY0, SHIELD_EVERY);
    s = notTodays(s, day, 7);
    expect(s.streak).toBe(0);
    day = addDays(day, 7);
    s = yesDays(s, day, SHIELD_EVERY - 1);
    expect(yesOn(s, addDays(day, SHIELD_EVERY - 1)).celebration?.id).toBe('day-7');
  });

  it('does not say Day 7 earned a shield with all of them already banked', () => {
    const s = { ...yesDays(newGoal(), DAY0, SHIELD_EVERY - 1), shields: SHIELD_CAP };
    expect(yesOn(s, addDays(DAY0, SHIELD_EVERY - 1)).celebration).toBeNull();
  });
});

describe('across dates', () => {
  it('arrives on Day 7 through the fall-back change', () => {
    // 10-27 to 11-02: the US clocks go back on 11-01.
    const from = '2026-10-27';
    const s = yesDays(newGoal({ day: from }), from, SHIELD_EVERY - 1);
    expect(yesOn(s, addDays(from, SHIELD_EVERY - 1)).celebration?.id).toBe('day-7');
  });

  it('arrives on Day 30 through the fall-back change', () => {
    const s = yesDays(newGoal(), DAY0, THIRTY_DAY_MARK - 1); // runs past 11-01
    expect(yesOn(s, addDays(DAY0, THIRTY_DAY_MARK - 1)).celebration?.id).toBe('day-30');
  });

  it('arrives the same in another time zone', () => {
    const s = yesDays(newGoal({ tz: TOKYO }), DAY0, SHIELD_EVERY - 1, TOKYO);
    expect(yesOn(s, addDays(DAY0, SHIELD_EVERY - 1), TOKYO).celebration?.id).toBe('day-7');
  });

  it('counts the streak, not the calendar: a long absence still reaches Day 7 on a fresh run', () => {
    let s = { ...yesDays(newGoal(), DAY0, 3), shields: 0 };
    // Weeks away: past the grace days, the misses take the streak to 0, which ends the run.
    const back = addDays(DAY0, 3 + 21);
    const first = answerDay(s, back, 'yes', { timeDay: addDays(back, 1) }); // late: the day before went missed
    expect(first.state.streak).toBe(1);
    s = yesDays(first.state, addDays(back, 1), SHIELD_EVERY - 2);
    expect(yesOn(s, addDays(back, SHIELD_EVERY - 1)).celebration?.id).toBe('day-7');
  });
});
