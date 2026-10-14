// SPEC 2 notifications: 7 days ahead, 2 per unanswered day, stop at the 7-miss reset, then weekly nudges.
import { describe, expect, it } from '@jest/globals';

import { planReminders, REENGAGE_NUDGE_COUNT, type PlannedReminder } from '../reminders';
import { resolve, setMorningTime } from '../resolve';
import { at, answerDay, DAY0, DENVER, newGoal, yesDays } from './fixtures';

const OFF = { reengage: false };
const ON = { reengage: true };

const kinds = (plan: PlannedReminder[], kind: PlannedReminder['kind']) => plan.filter((r) => r.kind === kind);
const isoOf = (plan: PlannedReminder[]) => plan.map((r) => r.at.toISOString());

describe('planReminders', () => {
  it('schedules an evening check-in and a morning reminder for each of the next 7 days', () => {
    const plan = planReminders(newGoal(), at(DAY0, '12:00'), OFF);
    const days = ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19'];
    expect(kinds(plan, 'checkin').map((r) => [r.day, r.at])).toEqual(days.map((d) => [d, at(d, '20:00')]));
    expect(kinds(plan, 'morning').map((r) => [r.day, r.at])).toEqual(
      days.map((d, i) => [d, at(`2026-10-${14 + i}`, '09:00')]),
    );
    expect(plan).toHaveLength(14);
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
    expect(kinds(plan, 'checkin')).toHaveLength(7);
  });

  it('skips morning reminders that would fall outside the window', () => {
    const plan = planReminders(setMorningTime(newGoal(), '21:00'), at(DAY0, '12:00'), OFF);
    expect(kinds(plan, 'morning')).toEqual([]);
  });

  it('stops at the window whose miss would be the 7th in a row', () => {
    const s = resolve(answerDay(newGoal(), DAY0, 'yes').state, at('2026-10-17', '20:30'), DENVER).state;
    expect(s.consecutiveMissed).toBe(3); // 10-14 .. 10-16
    const plan = planReminders(s, at('2026-10-17', '20:30'), OFF);
    // Misses #4–#7 would be 10-17 .. 10-20. Nothing for 10-21, which opens as the reset lands.
    expect(kinds(plan, 'checkin').map((r) => r.day)).toEqual(['2026-10-18', '2026-10-19', '2026-10-20']);
    expect(kinds(plan, 'morning').map((r) => r.day)).toEqual(['2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']);
    expect(plan.at(-1)?.at).toEqual(at('2026-10-21', '09:00')); // last reminder, before the 20:00 reset
  });

  it('after the 7th-miss reset, sends only weekly nudges, starting a week later', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 20), at('2026-11-09', '20:00'), DENVER).state;
    expect(s.consecutiveMissed).toBe(7); // reset when 11-08 closed at 20:00 on 11-09
    expect(planReminders(s, at('2026-11-09', '20:00'), OFF)).toEqual([]);

    const plan = planReminders(s, at('2026-11-09', '20:00'), ON);
    expect(plan).toHaveLength(REENGAGE_NUDGE_COUNT);
    expect(plan.every((r) => r.kind === 'reengage')).toBe(true);
    expect(plan.slice(0, 3).map((r) => r.at)).toEqual([
      at('2026-11-16', '20:00'),
      at('2026-11-23', '20:00'),
      at('2026-11-30', '20:00'),
    ]);
  });

  it('keeps nudging weekly from the original reset during a long absence', () => {
    const s = resolve(yesDays(newGoal(), DAY0, 20), at('2026-12-17', '21:00'), DENVER).state; // 45 missed
    const plan = planReminders(s, at('2026-12-17', '21:00'), ON);
    expect(plan[0]).toEqual({ at: at('2026-12-21', '20:00'), kind: 'reengage', day: '2026-12-21' });
    expect(plan).toHaveLength(REENGAGE_NUDGE_COUNT);
  });

  it('pre-schedules nudges after the projected reset, in case the app is never opened again', () => {
    const plan = planReminders(newGoal(), at(DAY0, '12:00'), ON);
    expect(kinds(plan, 'checkin')).toHaveLength(7);
    // Misses #1–#7 would be 10-13 .. 10-19; the reset lands at 20:00 on 10-20.
    expect(kinds(plan, 'reengage')[0]?.at).toEqual(at('2026-10-27', '20:00'));
    expect(plan.length).toBeLessThanOrEqual(64); // iOS keeps at most 64 pending notifications
  });

  it('brings daily reminders back after any answer', () => {
    const dormant = resolve(yesDays(newGoal(), DAY0, 3), at('2026-11-02', '21:00'), DENVER).state;
    expect(dormant.consecutiveMissed).toBeGreaterThanOrEqual(7);
    const back = answerDay(dormant, '2026-11-02', 'not-today').state;
    expect(kinds(planReminders(back, at('2026-11-02', '21:00'), OFF), 'checkin')).toHaveLength(7);
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
