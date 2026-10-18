import { describe, expect, it } from '@jest/globals';

import {
  firstGoalDay,
  goalDayOnOrAfter,
  isGoalDay,
  latestScheduleEntry,
  nextGoalDay,
  prevGoalDay,
  scheduleEntryFor,
} from '../goalDays';
import { setCheckInTime } from '../resolve';
import { at, DAY0, newGoal, yesDays } from './fixtures';

describe('goal days, checking in every day', () => {
  it('starts on the first day and steps one calendar day at a time', () => {
    const s = newGoal();
    expect(firstGoalDay(s)).toBe(DAY0);
    expect(isGoalDay(s, '2026-10-12')).toBe(false);
    expect(isGoalDay(s, DAY0)).toBe(true);
    expect(nextGoalDay(s, '2026-10-12')).toBe(DAY0);
    expect(nextGoalDay(s, DAY0)).toBe('2026-10-14');
    expect(nextGoalDay(s, '2026-12-31')).toBe('2027-01-01');
    expect(goalDayOnOrAfter(s, '2026-10-01')).toBe(DAY0);
    expect(goalDayOnOrAfter(s, '2026-10-20')).toBe('2026-10-20');
  });

  it('steps back to the day before, and to nothing before the first day', () => {
    const s = newGoal();
    expect(prevGoalDay(s, DAY0)).toBeNull();
    expect(prevGoalDay(s, '2026-10-14')).toBe(DAY0);
    expect(prevGoalDay(s, '2026-11-01')).toBe('2026-10-31');
  });

  it('finds the schedule entry in force on a day, and the latest one', () => {
    let s = yesDays(newGoal(), DAY0, 3);
    s = setCheckInTime(s, '07:00', at('2026-10-16', '12:00'), s.checkInSchedule[0]!.tz).state;
    expect(scheduleEntryFor(s, '2026-10-15').time).toBe('20:00');
    expect(scheduleEntryFor(s, '2026-10-17').time).toBe('07:00');
    expect(latestScheduleEntry(s).time).toBe('07:00');
  });
});
