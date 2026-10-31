// SPEC 2 notifications: 2 per unanswered day until a run of misses would reset (7 free days
// plus the slide), then weekly nudges.
import { describe, expect, it } from '@jest/globals';

import { addDays } from '../dates';
import {
  LAPSE_ENCOURAGE_FROM,
  lapseStage,
  planAllReminders,
  planReminders,
  REENGAGE_NUDGE_COUNT,
  REMINDER_MAX_WINDOWS,
  type PlannedReminder,
} from '../reminders';
import { resolve, setMorningTime } from '../resolve';
import { MISSED_GRACE_DAYS } from '../rules';
import type { GoalState, TimeZone } from '../types';
import { at, answerDay, DAY0, DENVER, newGoal, notTodays, SANTIAGO, TOKYO, yesDays } from './fixtures';

const OFF = { reengage: false };
const ON = { reengage: true };

const kinds = (plan: PlannedReminder[], kind: PlannedReminder['kind']) => plan.filter((r) => r.kind === kind);
const isoOf = (plan: PlannedReminder[]) => plan.map((r) => r.at.toISOString());
const daysFrom = (from: string, n: number) => Array.from({ length: n }, (_, i) => addDays(from, i));

describe('planReminders', () => {
  it('covers a fresh run up to the reset: 7 free misses plus a 7-step slide', () => {
    expect(REMINDER_MAX_WINDOWS).toBe(14);
    const plan = planReminders(newGoal(), at(DAY0, '12:00'), OFF);
    const days = daysFrom(DAY0, 14); // 10-13 .. 10-26
    // Plus 10-27's check-in, while 10-26 is still open: the reset only lands at midnight after it.
    const checkInDays = daysFrom(DAY0, 15);
    expect(kinds(plan, 'checkin').map((r) => [r.day, r.at])).toEqual(checkInDays.map((d) => [d, at(d, '20:00')]));
    expect(kinds(plan, 'morning').map((r) => [r.day, r.at])).toEqual(days.map((d) => [d, at(addDays(d, 1), '09:00')]));
    expect(plan).toHaveLength(29);
    expect(isoOf(plan)).toEqual([...isoOf(plan)].sort());
  });

  it('drops times already past', () => {
    const plan = planReminders(newGoal(), at(DAY0, '21:00'), OFF); // today's check-in already fired
    expect(kinds(plan, 'checkin')[0]?.day).toBe('2026-10-14');
    expect(kinds(plan, 'morning')[0]).toEqual({ at: at('2026-10-14', '09:00'), kind: 'morning', day: DAY0 });
    expect(plan.every((r) => r.at.getTime() > at(DAY0, '21:00').getTime())).toBe(true);
  });

  it('sends no morning reminder for a day already answered', () => {
    const s = answerDay(newGoal(), DAY0, 'yes').state;
    const plan = planReminders(s, at(DAY0, '21:00'), OFF);
    expect(plan.some((r) => r.day === DAY0)).toBe(false);
    expect(plan[0]).toEqual({ at: at('2026-10-14', '20:00'), kind: 'checkin', day: '2026-10-14' });
    expect(kinds(plan, 'checkin')).toHaveLength(15); // 14 windows, then the day after the reset day
  });

  it('marks a check-in that arrives while the day before is still open', () => {
    const plan = planReminders(newGoal(), at(DAY0, '12:00'), OFF);
    const checkIns = kinds(plan, 'checkin');
    expect(checkIns[0]).toEqual({ at: at(DAY0, '20:00'), kind: 'checkin', day: DAY0 });
    expect(checkIns.slice(1).map((r) => [r.day, r.earlier])).toEqual(
      daysFrom('2026-10-14', 14).map((d) => [d, addDays(d, -1)]),
    );
    expect(kinds(plan, 'morning').every((r) => r.earlier === undefined)).toBe(true);

    // Once yesterday is answered, today's check-in is a plain one again.
    const answered = answerDay(newGoal(), DAY0, 'yes', { timeDay: '2026-10-14', time: '09:30' }).state;
    expect(kinds(planReminders(answered, at('2026-10-14', '09:30'), OFF), 'checkin')[0]).toEqual({
      at: at('2026-10-14', '20:00'),
      kind: 'checkin',
      day: '2026-10-14',
    });
  });

  it('sends one notification a day when the reminder is at check-in time', () => {
    const plan = planReminders(setMorningTime(newGoal(), '20:00'), at(DAY0, '12:00'), OFF);
    expect(kinds(plan, 'morning')).toEqual([]);
    // Each check-in after the first asks about yesterday too.
    expect(kinds(plan, 'checkin').slice(1).every((r) => r.earlier === addDays(r.day, -1))).toBe(true);
    const times = isoOf(plan);
    expect(new Set(times).size).toBe(times.length);
  });

  it('reminds later the same day for a shift worker, before the next check-in', () => {
    const shift = newGoal({ checkInTime: '06:00', morningTime: '14:00' });
    const plan = planReminders(shift, at(DAY0, '05:00'), OFF);
    expect(plan.slice(0, 4)).toEqual([
      { at: at(DAY0, '06:00'), kind: 'checkin', day: DAY0 },
      { at: at(DAY0, '14:00'), kind: 'morning', day: DAY0 },
      { at: at('2026-10-14', '06:00'), kind: 'checkin', day: '2026-10-14', earlier: DAY0 },
      { at: at('2026-10-14', '14:00'), kind: 'morning', day: '2026-10-14' },
    ]);
    expect(isoOf(plan)).toEqual([...isoOf(plan)].sort());
    expect(kinds(plan, 'morning')).toHaveLength(14);
  });

  it('stops sooner when the slide is already under way', () => {
    let s = { ...yesDays(newGoal(), DAY0, 10), shields: 0 }; // through 10-22
    s = notTodays(s, '2026-10-23', 5); // streak 5, slide 5
    s = resolve(s, at('2026-11-01', '00:30'), DENVER).state; // 10-28 .. 10-30 missed, free
    expect(s).toMatchObject({ consecutiveMissed: 3, slide: 5 });
    const plan = planReminders(s, at('2026-11-01', '00:30'), OFF);
    // Misses #4–#7 are free (10-31 .. 11-03); #8 is slip 6 (11-04); #9 is the final (11-05).
    // 11-06's check-in comes while 11-05 is still open; the reset lands at midnight after it.
    expect(kinds(plan, 'checkin').map((r) => r.day)).toEqual(daysFrom('2026-11-01', 6));
    expect(kinds(plan, 'morning').map((r) => r.day)).toEqual(daysFrom('2026-10-31', 6));
    expect(plan.at(-1)).toMatchObject({ at: at('2026-11-06', '20:00'), kind: 'checkin', day: '2026-11-06', earlier: '2026-11-05' });
    expect(plan.at(-1)!.at.getTime()).toBeLessThan(at('2026-11-07', '00:00').getTime()); // before the reset
  });

  it('keeps going while shields would save the streak, up to the window cap', () => {
    const s = yesDays(newGoal(), DAY0, 21); // 3 shields, through 11-02
    const plan = planReminders(s, at('2026-11-02', '21:00'), ON);
    // The 14th miss (11-16) would spend a shield, so the cap ends daily reminders, not a reset.
    expect(kinds(plan, 'checkin').map((r) => r.day)).toEqual(daysFrom('2026-11-03', 14));
    expect(kinds(plan, 'reengage')[0]?.at).toEqual(at('2026-11-24', '20:00'));
    expect(plan.length).toBeLessThanOrEqual(64);
  });

  it('after a missed-day reset, sends only weekly nudges, starting a week later', () => {
    const s = resolve({ ...yesDays(newGoal(), DAY0, 20), shields: 0 }, at('2026-11-17', '00:00'), DENVER).state;
    expect(s).toMatchObject({ paused: true, consecutiveMissed: 14 }); // reset when 11-15 closed
    expect(planReminders(s, at('2026-11-17', '00:00'), OFF)).toEqual([]);

    const plan = planReminders(s, at('2026-11-17', '00:00'), ON);
    expect(plan).toHaveLength(REENGAGE_NUDGE_COUNT);
    expect(plan.every((r) => r.kind === 'reengage')).toBe(true);
    expect(plan.slice(0, 3).map((r) => r.at)).toEqual([
      at('2026-11-23', '20:00'),
      at('2026-11-30', '20:00'),
      at('2026-12-07', '20:00'),
    ]);
  });

  it('keeps nudging weekly from the original reset during a long absence', () => {
    const s = resolve({ ...yesDays(newGoal(), DAY0, 20), shields: 0 }, at('2026-12-17', '21:00'), DENVER).state;
    const plan = planReminders(s, at('2026-12-17', '21:00'), ON);
    expect(plan[0]).toEqual({ at: at('2026-12-21', '20:00'), kind: 'reengage', day: '2026-12-21' });
    expect(plan).toHaveLength(REENGAGE_NUDGE_COUNT);
  });

  it('pre-schedules nudges after the projected reset, in case the app is never opened again', () => {
    const plan = planReminders(newGoal(), at(DAY0, '12:00'), ON);
    expect(kinds(plan, 'checkin')).toHaveLength(15);
    // Misses #1–#14 would be 10-13 .. 10-26; the reset lands at midnight ending 10-27.
    expect(kinds(plan, 'reengage')[0]?.at).toEqual(at('2026-11-03', '20:00'));
    expect(plan.length).toBeLessThanOrEqual(64); // iOS keeps at most 64 pending notifications
  });

  it('brings daily reminders back after any answer, with the slide carried over', () => {
    const back = at('2026-11-03', '00:30');
    const dormant = resolve(yesDays(newGoal(), DAY0, 3), back, DENVER).state;
    expect(dormant.paused).toBe(true);
    const yes = answerDay(dormant, '2026-11-02', 'yes', { timeDay: '2026-11-03', time: '00:30' }).state;
    // 14 windows to the projected reset, plus the next day's check-in before it lands.
    expect(kinds(planReminders(yes, back, OFF), 'checkin')).toHaveLength(15);
    const no = answerDay(dormant, '2026-11-02', 'not-today', { timeDay: '2026-11-03', time: '00:30' }).state; // slip 1
    expect(kinds(planReminders(no, back, OFF), 'checkin')).toHaveLength(14);
  });

  it('lands on the right local wall times across the fall-back change', () => {
    const s = newGoal({ day: '2026-10-29' });
    const plan = planReminders(s, at('2026-10-29', '12:00'), OFF);
    expect(isoOf(kinds(plan, 'checkin')).slice(0, 5)).toEqual([
      '2026-10-30T02:00:00.000Z', // 20:00 MDT
      '2026-10-31T02:00:00.000Z',
      '2026-11-01T02:00:00.000Z',
      '2026-11-02T03:00:00.000Z', // 20:00 MST
      '2026-11-03T03:00:00.000Z',
    ]);
    expect(isoOf(kinds(plan, 'morning')).slice(0, 4)).toEqual([
      '2026-10-30T15:00:00.000Z', // 09:00 MDT
      '2026-10-31T15:00:00.000Z',
      '2026-11-01T16:00:00.000Z', // 09:00 MST
      '2026-11-02T16:00:00.000Z',
    ]);
  });
});

describe('lapseStage', () => {
  it('starts encouraging from day 4, whatever is held', () => {
    expect(LAPSE_ENCOURAGE_FROM).toBe(4);
    expect(lapseStage(LAPSE_ENCOURAGE_FROM - 1, 5, false)).toBeNull();
    expect(lapseStage(LAPSE_ENCOURAGE_FROM, 5, false)).toBe('encourage');
    expect(lapseStage(LAPSE_ENCOURAGE_FROM, 0, false)).toBe('encourage');
  });

  it('warns on the last free day and shows the slide after it, with zeros to lose', () => {
    expect(lapseStage(MISSED_GRACE_DAYS - 1, 5, false)).toBe('encourage');
    expect(lapseStage(MISSED_GRACE_DAYS, 5, false)).toBe('warning');
    expect(lapseStage(MISSED_GRACE_DAYS + 1, 5, false)).toBe('slipping');
  });

  it('stays encouraging with no zeros, even when a miss would reset', () => {
    expect(lapseStage(MISSED_GRACE_DAYS, 0, false)).toBe('encourage');
    expect(lapseStage(MISSED_GRACE_DAYS + 1, 0, false)).toBe('encourage');
    expect(lapseStage(14, 0, true)).toBe('encourage');
  });

  it('calls last call as soon as the next miss would take the last zeros', () => {
    expect(lapseStage(14, 14, true)).toBe('last-call');
    expect(lapseStage(10, 1, true)).toBe('last-call');
  });
});

describe('planReminders: the lapse on each reminder', () => {
  /** [day, kind, stage, zeros] for each daily reminder. */
  const timeline = (plan: PlannedReminder[]) =>
    plan.filter((r) => r.kind !== 'reengage').map((r) => [r.day, r.kind, r.lapse?.stage ?? null, r.lapse?.zeros ?? null]);
  const stagesOf = (plan: PlannedReminder[]) => plan.map((r) => r.lapse?.stage ?? null);

  // Answered through 11-01: 11-02 is day 1, and with no shields 11-15 (day 14) is the final.
  const twenty = () => ({ ...yesDays(newGoal(), DAY0, 20), shields: 0 });
  const after20 = at('2026-11-01', '21:00');

  it('walks a fresh absence from the plain question to last call', () => {
    expect(timeline(planReminders(twenty(), after20, OFF))).toEqual([
      ['2026-11-02', 'checkin', null, null],
      ['2026-11-02', 'morning', null, null],
      ['2026-11-03', 'checkin', null, null],
      ['2026-11-03', 'morning', null, null],
      ['2026-11-04', 'checkin', null, null],
      ['2026-11-04', 'morning', null, null],
      ['2026-11-05', 'checkin', 'encourage', 20],
      ['2026-11-05', 'morning', 'encourage', 20],
      ['2026-11-06', 'checkin', 'encourage', 20],
      ['2026-11-06', 'morning', 'encourage', 20],
      ['2026-11-07', 'checkin', 'encourage', 20],
      ['2026-11-07', 'morning', 'encourage', 20],
      ['2026-11-08', 'checkin', 'warning', 20],
      ['2026-11-08', 'morning', 'warning', 20],
      ['2026-11-09', 'checkin', 'slipping', 20],
      ['2026-11-09', 'morning', 'slipping', 20], // 11-08's miss was free, and 11-09's hasn't landed
      ['2026-11-10', 'checkin', 'slipping', 20], // 11-09 is still open, so nothing is gone yet
      ['2026-11-10', 'morning', 'slipping', 19],
      ['2026-11-11', 'checkin', 'slipping', 19],
      ['2026-11-11', 'morning', 'slipping', 18],
      ['2026-11-12', 'checkin', 'slipping', 18],
      ['2026-11-12', 'morning', 'slipping', 17],
      ['2026-11-13', 'checkin', 'slipping', 17],
      ['2026-11-13', 'morning', 'slipping', 16],
      ['2026-11-14', 'checkin', 'slipping', 16],
      ['2026-11-14', 'morning', 'slipping', 15],
      ['2026-11-15', 'checkin', 'slipping', 15],
      ['2026-11-15', 'morning', 'last-call', 14],
      ['2026-11-16', 'checkin', 'last-call', 14], // the reset lands at midnight after this
    ]);
  });

  it('numbers each reminder by the miss its own day would be', () => {
    const plan = planReminders(twenty(), after20, OFF);
    expect(plan.find((r) => r.day === '2026-11-05')?.lapse?.missedInRow).toBe(4);
    expect(plan.find((r) => r.day === '2026-11-08')?.lapse?.missedInRow).toBe(7);
    expect(plan.at(-1)?.lapse?.missedInRow).toBe(15);
  });

  it('only ever encourages a goal with no zeros', () => {
    const plan = planReminders(newGoal(), at(DAY0, '12:00'), OFF);
    expect(stagesOf(plan).slice(0, 6)).toEqual(Array(6).fill(null));
    expect(new Set(stagesOf(plan).slice(6))).toEqual(new Set(['encourage']));
  });

  it('never marks a weekly nudge', () => {
    const plan = planReminders(twenty(), after20, ON);
    expect(kinds(plan, 'reengage')).toHaveLength(REENGAGE_NUDGE_COUNT);
    expect(kinds(plan, 'reengage').every((r) => r.lapse === undefined)).toBe(true);
  });

  it('calls last call sooner when the slide is already under way', () => {
    let s = { ...yesDays(newGoal(), DAY0, 10), shields: 0 }; // through 10-22
    s = notTodays(s, '2026-10-23', 5); // streak 5, slide 5
    s = resolve(s, at('2026-11-01', '00:30'), DENVER).state; // 3 free misses so far
    expect(timeline(planReminders(s, at('2026-11-01', '00:30'), OFF)).slice(-6)).toEqual([
      ['2026-11-03', 'morning', 'warning', 5], // miss #7
      ['2026-11-04', 'checkin', 'slipping', 5],
      ['2026-11-04', 'morning', 'slipping', 5],
      ['2026-11-05', 'checkin', 'slipping', 5],
      ['2026-11-05', 'morning', 'last-call', 4], // miss #9 is the final
      ['2026-11-06', 'checkin', 'last-call', 4],
    ]);
  });

  it('has no last call while a shield would take the final', () => {
    const s = yesDays(newGoal(), DAY0, 21); // 3 shields, through 11-02
    expect(s.shields).toBeGreaterThan(0);
    const plan = planReminders(s, at('2026-11-02', '21:00'), OFF);
    const stages = stagesOf(plan);
    expect(stages).not.toContain('last-call');
    expect(stages).toContain('warning');
    expect(stages.at(-1)).toBe('slipping');
  });

  it('calls last call on the last zero of a short run, then goes back to encouraging', () => {
    const s = { ...yesDays(newGoal(), DAY0, 3), shields: 0 }; // through 10-15
    expect(timeline(planReminders(s, at('2026-10-15', '21:00'), OFF)).slice(12)).toEqual([
      ['2026-10-22', 'checkin', 'warning', 3], // day 7
      ['2026-10-22', 'morning', 'warning', 3],
      ['2026-10-23', 'checkin', 'slipping', 3],
      ['2026-10-23', 'morning', 'slipping', 3],
      ['2026-10-24', 'checkin', 'slipping', 3],
      ['2026-10-24', 'morning', 'slipping', 2],
      ['2026-10-25', 'checkin', 'slipping', 2],
      ['2026-10-25', 'morning', 'last-call', 1],
      ['2026-10-26', 'checkin', 'last-call', 1],
      ['2026-10-26', 'morning', 'encourage', 0],
      ['2026-10-27', 'checkin', 'encourage', 0],
      ['2026-10-27', 'morning', 'encourage', 0],
      ['2026-10-28', 'checkin', 'encourage', 0],
      ['2026-10-28', 'morning', 'encourage', 0],
      ['2026-10-29', 'checkin', 'encourage', 0],
      ['2026-10-29', 'morning', 'encourage', 0],
      ['2026-10-30', 'checkin', 'encourage', 0],
    ]);
  });

  it('starts the count over after any answer', () => {
    const s = yesDays(newGoal(), DAY0, 10); // through 10-22
    const back = at('2026-10-28', '21:00'); // 10-23 .. 10-26 missed, free
    const lapsing = planReminders(resolve(s, back, DENVER).state, back, OFF);
    expect(lapsing[0]?.lapse?.stage).toBe('encourage');

    for (const ans of ['yes', 'not-today'] as const) {
      const answered = answerDay(s, '2026-10-27', ans, { timeDay: '2026-10-28', time: '21:00' }).state;
      const plan = planReminders(answered, back, OFF);
      // 10-28 is now day 1, so 10-31 is day 4.
      expect(plan.filter((r) => r.day < '2026-10-31').every((r) => r.lapse === undefined)).toBe(true);
      expect(plan.find((r) => r.day === '2026-10-31')?.lapse).toMatchObject({ stage: 'encourage', missedInRow: 4 });
    }
  });

  it('counts check-in days, not calendar days, for a goal on chosen days', () => {
    const s = answerDay(newGoal({ days: [1, 3, 5] }), '2026-10-14', 'yes').state; // Mon, Wed, Fri; streak 1
    const plan = planReminders(s, at('2026-10-14', '21:00'), OFF);
    // Check-in days after: 10-16, 19, 21, 23 (day 4), 26, 28, 30 (day 7), 11-02 (day 8).
    const checkIns = kinds(plan, 'checkin');
    expect(checkIns.map((r) => [r.day, r.lapse?.stage ?? null]).slice(0, 8)).toEqual([
      ['2026-10-16', null],
      ['2026-10-19', null],
      ['2026-10-21', null],
      ['2026-10-23', 'encourage'],
      ['2026-10-26', 'encourage'],
      ['2026-10-28', 'encourage'],
      ['2026-10-30', 'warning'],
      ['2026-11-02', 'last-call'], // the first slip would take its only zero
    ]);
    // Their windows don't overlap, so each check-in stands alone and keeps its buttons.
    expect(checkIns.every((r) => r.earlier === undefined)).toBe(true);
  });

  it('picks up mid-absence when the app was closed for weeks', () => {
    const s = yesDays(newGoal(), DAY0, 21); // 3 shields, through 11-02
    const back = at('2026-11-25', '12:00'); // 21 closed days: misses #14 and #21 each spent a shield
    const state = resolve(s, back, DENVER).state;
    expect(state.paused).toBe(false);
    expect(state.shields).toBe(s.shields - 2);
    const plan = planReminders(state, back, OFF);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0]?.lapse?.stage).toBe('slipping');
    expect(plan[0]?.lapse?.missedInRow).toBeGreaterThan(MISSED_GRACE_DAYS);
  });

  it('sets no lapse once reminders have paused', () => {
    const s = resolve(twenty(), at('2026-11-17', '00:00'), DENVER).state;
    expect(s.paused).toBe(true);
    expect(planReminders(s, at('2026-11-17', '00:00'), ON).every((r) => r.lapse === undefined)).toBe(true);
  });

  it('carries through the plan for several goals', () => {
    const one = twenty();
    const plan = planAllReminders([one, { ...one, goalId: 'g2' }], after20, { reengage: false, budget: 60 });
    const g2 = plan.filter((r) => r.goalId === 'g2');
    expect(g2.find((r) => r.day === '2026-11-08')?.lapse).toMatchObject({ stage: 'warning', zeros: 20 });
  });

  describe('holds the zeros the app would show when the reminder fires', () => {
    const cases: [string, GoalState, Date, TimeZone][] = [
      ['a fresh absence across the US fall-back', twenty(), after20, DENVER],
      ['a short run', { ...yesDays(newGoal(), DAY0, 3), shields: 0 }, at('2026-10-15', '21:00'), DENVER],
      ['shields', yesDays(newGoal(), DAY0, 21), at('2026-11-02', '21:00'), DENVER],
      [
        'a slide under way',
        { ...notTodays(yesDays(newGoal(), DAY0, 10), '2026-10-23', 5), shields: 0 },
        at('2026-10-27', '21:00'),
        DENVER,
      ],
      ['a shift worker', { ...yesDays(newGoal({ checkInTime: '06:00', morningTime: '14:00' }), DAY0, 20), shields: 0 }, at('2026-11-01', '21:00'), DENVER],
      ['a trip to Tokyo', twenty(), at('2026-11-06', '12:00', TOKYO), TOKYO],
      [
        'a spring-forward at midnight',
        (() => {
          // Chile springs forward at midnight starting 09-06, in the middle of this absence.
          const s = newGoal({ day: '2026-09-01', tz: SANTIAGO });
          const a = answerDay(s, '2026-09-01', 'yes', { tz: SANTIAGO }).state;
          return { ...a, streak: 12, runPeak: 12, bestStreak: 12, shields: 0 };
        })(),
        at('2026-09-01', '21:00', SANTIAGO),
        SANTIAGO,
      ],
    ];

    it.each(cases)('with %s', (_name, goal, now, tz) => {
      const state = resolve(goal, now, tz).state;
      const lapsing = planReminders(state, now, OFF).filter((r) => r.lapse);
      expect(lapsing.length).toBeGreaterThan(0);
      for (const r of lapsing) {
        const then = resolve(state, r.at, tz).state;
        expect([r.day, r.kind, r.lapse?.zeros]).toEqual([r.day, r.kind, then.streak]);
        if (r.lapse?.stage === 'last-call') expect(then.streak).toBeGreaterThan(0);
      }
    });
  });
});
