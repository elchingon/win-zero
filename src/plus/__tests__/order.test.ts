import { describe, expect, it } from '@jest/globals';

import type { GoalState } from '@/engine';
import { answerDay, at, DAY0, DENVER, NEW_YORK, newGoal, TOKYO, yesDays } from '@/engine/__tests__/fixtures';
import type { GoalSlot, RoundRecord } from '@/store';

import { homeCards } from '../home/order';

const slot = (goal: GoalState, round: RoundRecord | null = null): GoalSlot => ({ goal, round, seenThrough: null });
const round = (day: string, played = false): RoundRecord => ({
  day,
  n: 2,
  rewards: { bomb: false, shield: false, shieldCapped: false, weapons: [], credits: [] },
  borrowed: [],
  played,
});
const ids = (slots: readonly GoalSlot[]) => slots.map((s) => s.goal.goalId);

describe("Home's order with several goals (SPEC 9)", () => {
  it('puts unplayed rounds first in goal order, then open check-ins by when they opened', () => {
    // Answered through 10-14; tonight's check-ins open at 20:00, 19:00 and 21:00.
    const a = { ...yesDays(newGoal(), DAY0, 2), goalId: 'a' };
    const b = { ...yesDays(newGoal({ checkInTime: '19:00' }), DAY0, 2), goalId: 'b' };
    const c = { ...yesDays(newGoal({ checkInTime: '21:00' }), DAY0, 2), goalId: 'c' };
    const cards = homeCards([slot(a, round('2026-10-14')), slot(b), slot(c, round('2026-10-14', true))], at('2026-10-15', '21:30'));
    expect(ids(cards.ready)).toEqual(['a']);
    expect(cards.open.map((o) => o.slot.goal.goalId)).toEqual(['b', 'a', 'c']);
    expect(cards.later).toEqual([]);
    // Nothing changes until the first of them closes: midnight at the end of 10-16.
    expect(cards.boundary).toBe(at('2026-10-17', '00:00').getTime());
  });

  it('keeps goal order between check-ins that opened together', () => {
    const a = { ...yesDays(newGoal(), DAY0, 2), goalId: 'a' };
    const b = { ...yesDays(newGoal(), DAY0, 2), goalId: 'b' };
    expect(homeCards([slot(a), slot(b)], at('2026-10-15', '21:00')).open.map((o) => o.slot.goal.goalId)).toEqual(['a', 'b']);
    expect(homeCards([slot(b), slot(a)], at('2026-10-15', '21:00')).open.map((o) => o.slot.goal.goalId)).toEqual(['b', 'a']);
  });

  it('orders by the moment a check-in opened, across time zones', () => {
    // 20:00 in Tokyo is 11:00 UTC; 20:00 in Denver is 02:00 UTC the next day. Listed Denver first.
    const denver = { ...yesDays(newGoal({ tz: DENVER }), DAY0, 2, DENVER), goalId: 'denver' };
    const tokyo = { ...yesDays(newGoal({ tz: TOKYO }), DAY0, 2, TOKYO), goalId: 'tokyo' };
    const now = new Date('2026-10-16T03:00:00Z');
    const cards = homeCards([slot(denver), slot(tokyo)], now);
    expect(cards.open.map((o) => o.slot.goal.goalId)).toEqual(['tokyo', 'denver']);
  });

  it('orders by the moment, through the evening the clocks go back', () => {
    // New York, 11-1: the clocks went back at 2 AM. Check-ins at 21:00 and 20:30.
    const late = { ...newGoal({ tz: NEW_YORK, day: '2026-10-30', checkInTime: '21:00' }), goalId: 'late' };
    const early = { ...newGoal({ tz: NEW_YORK, day: '2026-10-30', checkInTime: '20:30' }), goalId: 'early' };
    const answered = (g: GoalState) =>
      ['2026-10-30', '2026-10-31'].reduce((s, d) => answerDay(s, d, 'yes', { tz: NEW_YORK, time: '23:00' }).state, g);
    const cards = homeCards([slot(answered(late)), slot(answered(early))], at('2026-11-01', '22:00', NEW_YORK));
    expect(cards.open.map((o) => o.slot.goal.goalId)).toEqual(['early', 'late']);
    expect(cards.open[0]?.window.opensAt).toEqual(at('2026-11-01', '20:30', NEW_YORK));
  });

  it('waits for the next check-in of goals with nothing open, and wakes for the first', () => {
    const a = { ...yesDays(newGoal(), DAY0, 2), goalId: 'a' };
    const b = { ...yesDays(newGoal({ checkInTime: '19:00' }), DAY0, 2), goalId: 'b' };
    const cards = homeCards([slot(a), slot(b)], at('2026-10-15', '12:00'));
    expect(cards.open).toEqual([]);
    expect(cards.later.map((l) => [l.slot.goal.goalId, l.next.opensAt])).toEqual([
      ['a', at('2026-10-15', '20:00')],
      ['b', at('2026-10-15', '19:00')],
    ]);
    expect(cards.boundary).toBe(at('2026-10-15', '19:00').getTime());
  });
});
