// A goal's moments ahead, for Win Zero Plus's widgets (SPEC 9): each time what a widget shows
// changes with nobody answering, read from the real rules.
import { describe, expect, it } from '@jest/globals';

import { startBreak } from '../breaks';
import { addDays } from '../dates';
import { onBreak } from '../goalDays';
import { resolve } from '../resolve';
import { goalTimeline, TIMELINE_HORIZON_DAYS, type GoalMoment } from '../timeline';
import type { GoalState } from '../types';
import { at, DAY0, DENVER, newGoal, TOKYO, yesDays } from './fixtures';

const FAR = new Date('2030-01-01T00:00:00Z');
const opens = (ms: GoalMoment[]) => ms.filter((m) => m.open).map((m) => m.open?.day);
const times = (ms: GoalMoment[]) => ms.map((m) => m.at.getTime());

describe('goalTimeline', () => {
  it('starts now, then each opening, closing and midnight, in order, up to its horizon', () => {
    const ms = goalTimeline(yesDays(newGoal(), DAY0, 2), at('2026-10-15', '12:00'), DENVER, FAR);
    expect(ms[0]?.at).toEqual(at('2026-10-15', '12:00'));
    expect(ms[0]).toMatchObject({ streak: 2, open: null, next: { day: '2026-10-15' } });
    const ts = times(ms);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(new Set(ts).size).toBe(ts.length);
    expect(ms.map((m) => m.at)).toEqual(expect.arrayContaining([at('2026-10-15', '20:00'), at('2026-10-16', '00:00'), at('2026-10-17', '00:00')]));
    const last = ms.at(-1)?.at.getTime() ?? 0;
    expect(last).toBeLessThanOrEqual(at(addDays('2026-10-15', TIMELINE_HORIZON_DAYS + 1), '00:00').getTime());
    expect(goalTimeline(newGoal(), at(DAY0, '12:00'), DENVER, at(DAY0, '21:00')).map((m) => m.at)).toEqual([
      at(DAY0, '12:00'),
      at(DAY0, '20:00'),
    ]);
  });

  it('opens each check-in, and with nobody answering, the 8th miss in a row slips a zero', () => {
    const ms = goalTimeline(yesDays(newGoal(), DAY0, 10), at('2026-10-23', '12:00'), DENVER, FAR);
    const streakOn = (day: string) => ms.filter((m) => m.at.getTime() <= at(day, '12:00').getTime()).at(-1)?.streak;
    expect(streakOn('2026-10-24')).toBe(10);
    // 10-23 to 10-29 are free; 10-30's miss (settled at midnight after 10-31) is the 8th.
    expect(streakOn('2026-10-31')).toBe(10);
    expect(streakOn('2026-11-01')).toBe(9);
    // Each stays open until midnight the next day, so it's the open one across several moments.
    expect([...new Set(opens(ms))].slice(0, 3)).toEqual(['2026-10-23', '2026-10-24', '2026-10-25']);
  });

  it('keeps local midnights and every check-in through both changes of the clocks', () => {
    for (const [from, mid] of [
      ['2026-10-30', '2026-11-01'],
      ['2027-03-12', '2027-03-14'],
    ] as const) {
      const ms = goalTimeline(newGoal({ day: from }), at(from, '12:00'), DENVER, at(addDays(from, 4), '12:00'));
      expect(ms.map((m) => m.at)).toEqual(expect.arrayContaining([at(mid, '00:00'), at(addDays(mid, 1), '00:00'), at(mid, '20:00')]));
      const ts = times(ms);
      expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    }
  });

  it('follows the phone into a new time zone, as resolve does', () => {
    // Landing in Tokyo just after 10-14's Yes (21:00 in Denver): 10-15 checks in at 20:00 Tokyo time.
    const ms = goalTimeline(yesDays(newGoal(), DAY0, 2), at('2026-10-15', '12:00', TOKYO), TOKYO, FAR);
    const opening = ms.find((m) => m.open !== null);
    expect(opening?.at).toEqual(at('2026-10-15', '20:00', TOKYO));
    expect(opening?.open?.day).toBe('2026-10-15');
    expect(ms.map((m) => m.at)).toEqual(expect.arrayContaining([at('2026-10-16', '00:00', TOKYO)]));
  });

  it('opens nothing on a break, and says so while it runs', () => {
    const r = startBreak(yesDays(newGoal(), DAY0, 2), '2026-10-20', at('2026-10-15', '12:00'), DENVER);
    if (!r.ok) throw new Error(r.reason);
    const ms = goalTimeline(r.state, at('2026-10-15', '13:00'), DENVER, FAR);
    expect(opens(ms).filter((d) => d && onBreak(r.state, d))).toEqual([]);
    expect(ms[0]?.onBreak?.when).toBe('on');
    expect(ms.find((m) => m.open)?.open?.day).toBe('2026-10-21');
    expect(ms.find((m) => m.at.getTime() === at('2026-10-21', '00:00').getTime())?.onBreak).toBeNull();
  });

  it('opens nothing on rest days', () => {
    const ms = goalTimeline(newGoal({ days: [1, 3, 5] }), at(DAY0, '12:00'), DENVER, FAR);
    for (const day of opens(ms)) expect([1, 3, 5]).toContain(new Date(`${day}T12:00:00Z`).getUTCDay());
  });

  it('says reminders are paused after a reset, and keeps its check-ins', () => {
    const paused: GoalState = resolve(yesDays(newGoal(), DAY0, 1), at('2026-11-20', '12:00'), DENVER).state;
    expect(paused.paused).toBe(true);
    const ms = goalTimeline(paused, at('2026-11-20', '12:00'), DENVER, FAR);
    expect(ms.every((m) => m.paused)).toBe(true);
    expect(opens(ms).length).toBeGreaterThan(0);
    expect(ms.every((m) => m.streak === 0)).toBe(true);
  });
});
