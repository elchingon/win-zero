// Head start (SPEC 9): days already done before setup, recorded as Yeses through the usual rule, so
// the goal starts as a real run that long would, and today's check-in is just as for a new goal.
import { describe, expect, it } from '@jest/globals';

import { addDays, weekdayOf } from '../dates';
import { isGoalDay } from '../goalDays';
import {
  createGoalWithHeadStart,
  firstCheckInDay,
  HEAD_START_MAX,
  headStartPreview,
  isFirstCheckIn,
  isHeadStart,
  onlyHeadStart,
} from '../headStart';
import { createGoal, resolve, type CreateGoalInput } from '../resolve';
import type { DayKey, GoalState, TimeZone } from '../types';
import { nextWindow, pendingWindow } from '../windows';
import { answerDay, at, DAY0, DENVER, KIRITIMATI, newGoal, PAGO_PAGO, TOKYO, yesDays } from './fixtures';

const MON_FRI = [1, 2, 3, 4, 5];
const MON_WED_FRI = [1, 3, 5];

function input(opts: { day?: DayKey; time?: string; tz?: TimeZone; days?: number[] } = {}): CreateGoalInput {
  const tz = opts.tz ?? DENVER;
  return { goalId: 'g1', goal: 'Stop drinking', days: opts.days, now: at(opts.day ?? DAY0, opts.time ?? '12:00', tz), tz };
}

function withHeadStart(n: number, opts: Parameters<typeof input>[0] = {}): GoalState {
  return createGoalWithHeadStart({ ...input(opts), headStart: n });
}

/** What a run's counters and entries come to, leaving out when each was answered. */
function shape(s: GoalState) {
  return {
    firstDay: s.firstDay,
    streak: s.streak,
    bestStreak: s.bestStreak,
    runPeak: s.runPeak,
    bombs: s.bombs,
    shields: s.shields,
    consecutiveMissed: s.consecutiveMissed,
    slide: s.slide,
    paused: s.paused,
    lastSettledDay: s.lastSettledDay,
    history: s.history.map((e) => ({ day: e.day, result: e.result, streakAfter: e.streakAfter })),
  };
}

const windowAt = (s: GoalState, now: Date) => {
  const w = pendingWindow(s, now) ?? nextWindow(s);
  return { day: w.day, opensAt: w.opensAt.getTime(), remindAt: w.remindAt?.getTime() ?? null, closesAt: w.closesAt.getTime() };
};

describe('createGoalWithHeadStart', () => {
  it('with no head start is a plain new goal', () => {
    expect(withHeadStart(0)).toEqual(createGoal(input()));
    expect(createGoalWithHeadStart(input())).toEqual(createGoal(input()));
  });

  it.each(Array.from({ length: HEAD_START_MAX }, (_, i) => i + 1))('a head start of %i comes out as that many real Yeses', (n) => {
    const start = addDays(DAY0, -n);
    const real = yesDays(newGoal({ day: start }), start, n);
    const s = withHeadStart(n);
    expect(shape(s)).toEqual(shape(real));
    expect(s.checkInSchedule[0]?.fromDay).toBe(start);
    expect(s.history.every(isHeadStart)).toBe(true);
    expect(s.history.every((e) => e.at === s.createdAt)).toBe(true);
    expect(s.createdAt).toBe(at(DAY0, '12:00').toISOString());
  });

  it('sets the zeros, bombs and shields a run of 30 earns', () => {
    const s = withHeadStart(30);
    expect(s).toMatchObject({ streak: 30, bestStreak: 30, runPeak: 30, bombs: 6, shields: 3, lastSettledDay: addDays(DAY0, -1) });
  });

  it('turns down a head start out of range', () => {
    for (const n of [-1, HEAD_START_MAX + 1, 1.5, Number.NaN]) expect(() => withHeadStart(n)).toThrow(RangeError);
  });

  it.each(['12:00', '21:00', '23:59', '00:30'])("leaves today's check-in as it is for a new goal (set up at %s)", (time) => {
    const plain = createGoal(input({ time }));
    const s = withHeadStart(12, { time });
    const now = at(DAY0, time);
    expect(windowAt(s, now)).toEqual(windowAt(plain, now));
    expect(pendingWindow(s, now) === null).toBe(pendingWindow(plain, now) === null);
  });

  it('settles nothing more when resolved straight after setup, or later the same day', () => {
    const s = withHeadStart(9);
    for (const time of ['12:00', '20:30', '23:59']) {
      const r = resolve(s, at(DAY0, time), DENVER);
      expect(r.events).toEqual([]);
      expect(r.state).toEqual(s);
    }
  });

  it('counts only check-in days on a weekday schedule', () => {
    // DAY0 is a Tuesday: the last four Monday, Wednesday or Friday days before it.
    const s = withHeadStart(4, { days: MON_WED_FRI });
    expect(s.history.map((e) => e.day)).toEqual(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12']);
    expect(s.firstDay).toBe('2026-10-05');
    expect(s.history.every((e) => isGoalDay(s, e.day))).toBe(true);
    expect(nextWindow(s).day).toBe('2026-10-14');
  });

  it('set up on a rest day, ends on the last check-in day and asks next on the next one', () => {
    // Saturday 2026-10-17, Monday to Friday.
    const s = withHeadStart(3, { day: '2026-10-17', days: MON_FRI });
    expect(s.history.map((e) => e.day)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(nextWindow(s).day).toBe('2026-10-19');
    expect(resolve(s, at('2026-10-18', '23:00'), DENVER).events).toEqual([]);
  });

  it('works on the local date, wherever the phone is', () => {
    const now = at(DAY0, '12:00');
    for (const tz of [TOKYO, KIRITIMATI, PAGO_PAGO]) {
      const s = createGoalWithHeadStart({ ...input({ tz }), now, headStart: 5 });
      const plain = createGoal({ ...input({ tz }), now });
      expect(s.history.at(-1)?.day).toBe(addDays(plain.firstDay, -1));
      expect(s.history.every((e) => e.tz === tz)).toBe(true);
      expect(windowAt(s, now)).toEqual(windowAt(plain, now));
    }
    // Kiritimati (UTC+14) and Pago Pago (UTC-11) are a calendar day apart at the same instant.
    const east = createGoalWithHeadStart({ ...input({ tz: KIRITIMATI }), now, headStart: 5 });
    const west = createGoalWithHeadStart({ ...input({ tz: PAGO_PAGO }), now, headStart: 5 });
    expect(east.firstDay).toBe(addDays(west.firstDay, 1));
  });

  it('runs across the spring-forward change like a real run', () => {
    const day = '2027-03-20';
    const n = 10; // back over Sunday 2027-03-14
    const start = addDays(day, -n);
    expect(shape(withHeadStart(n, { day }))).toEqual(shape(yesDays(newGoal({ day: start }), start, n)));
  });
});

describe('after a head start', () => {
  it('the first real Yes plays one more zero and is not a head-start day', () => {
    const s = answerDay(withHeadStart(6), DAY0, 'yes').state;
    expect(s.streak).toBe(7);
    expect(s.shields).toBe(1);
    expect(isHeadStart(s.history.at(-1)!)).toBe(false);
    expect(onlyHeadStart(s)).toBe(false);
  });

  it('a week away costs nothing; the 8th missed day takes a zero', () => {
    const s = withHeadStart(10);
    // Days DAY0..DAY0+6 close by the end of DAY0+7.
    const week = resolve(s, at(addDays(DAY0, 8), '00:30'), DENVER).state;
    expect(week.consecutiveMissed).toBe(7);
    expect(week.streak).toBe(10);
    const eighth = resolve(s, at(addDays(DAY0, 9), '00:30'), DENVER).state;
    expect(eighth.consecutiveMissed).toBe(8);
    expect(eighth.streak).toBe(9);
  });

  it('three weeks away, across the fall-back change: shields absorb both finals', () => {
    // 21 missed days, DAY0..DAY0+20 (Nov 1 among them): 7 free, 6 slips, a final, 6 slips, a final.
    const s = resolve(withHeadStart(30), at(addDays(DAY0, 22), '12:00'), DENVER).state;
    expect(s.history.filter((e) => e.result !== 'yes')).toHaveLength(21);
    expect(s).toMatchObject({ streak: 18, shields: 1, bestStreak: 30, paused: false });
  });

  it('a short head start with no shields resets and pauses, keeping the best', () => {
    const s = resolve(withHeadStart(6), at(addDays(DAY0, 30), '12:00'), DENVER).state;
    expect(s).toMatchObject({ streak: 0, bestStreak: 6, paused: true });
    const reset = s.history.findIndex((e) => e.reset);
    expect(s.history[reset]?.missedInRow).toBe(14);
    expect(s.history.slice(reset + 1).every((e) => e.paused)).toBe(true);
  });
});

describe('the first check-in', () => {
  it("is today's when set up after check-in time, with or without a head start", () => {
    for (const n of [0, 5]) {
      const s = withHeadStart(n, { time: '21:00' });
      expect(firstCheckInDay(s)).toBe(DAY0);
      expect(isFirstCheckIn(s, DAY0)).toBe(true);
    }
  });

  it('is not open at setup before check-in time', () => {
    for (const n of [0, 5]) expect(isFirstCheckIn(withHeadStart(n), DAY0)).toBe(false);
  });

  it('stops being the first once it settles', () => {
    const s = answerDay(withHeadStart(5, { time: '21:00' }), DAY0, 'not-today', { time: '21:30' }).state;
    expect(isFirstCheckIn(s, DAY0)).toBe(false);
  });

  it('on a weekday schedule set up on a rest day, is the next check-in day', () => {
    const s = withHeadStart(2, { day: '2026-10-17', days: MON_FRI, time: '21:00' });
    expect(firstCheckInDay(s)).toBe('2026-10-19');
    expect(weekdayOf(firstCheckInDay(s))).toBe(1);
    expect(isFirstCheckIn(s, '2026-10-19')).toBe(false);
  });
});

describe('headStartPreview', () => {
  it('says what the goal starts with and what it opens beyond the arsenal', () => {
    const p = headStartPreview(withHeadStart(30), 0);
    expect(p).toMatchObject({ zeros: 30, bombs: 6, shields: 3, firstRound: 31 });
    expect(p.weapons.map((w) => w.unlockAt)).toEqual([3, 7, 14, 30]);
    expect(headStartPreview(withHeadStart(30), 14).weapons.map((w) => w.unlockAt)).toEqual([30]);
    expect(headStartPreview(withHeadStart(5), 60).weapons).toEqual([]);
  });

  it('with no head start, the first round has one zero', () => {
    expect(headStartPreview(withHeadStart(0), 0)).toMatchObject({ zeros: 0, bombs: 0, shields: 0, firstRound: 1, weapons: [] });
  });
});
