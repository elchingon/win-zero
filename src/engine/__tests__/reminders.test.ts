// SPEC 2 notifications: 2 per unanswered day until a run of misses would reset (7 free days
// plus the slide), then weekly nudges.
import { describe, expect, it } from '@jest/globals';

import { addDays } from '../dates';
import { planReminders, REENGAGE_NUDGE_COUNT, REMINDER_MAX_WINDOWS, type PlannedReminder } from '../reminders';
import { resolve, setMorningTime } from '../resolve';
import { at, answerDay, DAY0, DENVER, newGoal, notTodays, yesDays } from './fixtures';

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

  it('keeps a morning time after check-in time inside the window', () => {
    const plan = planReminders(setMorningTime(newGoal(), '21:00'), at(DAY0, '12:00'), OFF);
    expect(kinds(plan, 'morning')[0]).toEqual({ at: at('2026-10-14', '21:00'), kind: 'morning', day: DAY0 });
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
    expect(plan.at(-1)).toEqual({ at: at('2026-11-06', '20:00'), kind: 'checkin', day: '2026-11-06', earlier: '2026-11-05' });
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
