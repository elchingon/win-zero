import { describe, expect, it } from '@jest/globals';

import { addDays } from '../dates';
import { createGoal, resolve, setMorningTime } from '../resolve';
import {
  closesAt,
  firstUpcomingDay,
  isMorningAtOrBeforeCheckIn,
  isWindowToday,
  nextWindow,
  pendingWindow,
  windowFor,
} from '../windows';
import { answerDay, at, DAY0, DENVER, newGoal, SANTIAGO } from './fixtures';

const HOUR = 3_600_000;

describe('windowFor (SPEC 2)', () => {
  it('opens at check-in time on D, reminds the next morning, and closes at midnight ending D+1', () => {
    const w = windowFor(newGoal(), DAY0);
    expect(w.day).toBe(DAY0);
    expect(w.tz).toBe(DENVER);
    expect(w.opensAt).toEqual(at('2026-10-13', '20:00'));
    expect(w.remindAt).toEqual(at('2026-10-14', '09:00'));
    expect(w.closesAt).toEqual(at('2026-10-15', '00:00'));
    expect(closesAt(newGoal(), DAY0)).toEqual(w.closesAt);
  });

  it('overlaps: D+1 opens at its check-in time while D is still open, and closes keep increasing', () => {
    const s = newGoal();
    const d = windowFor(s, '2026-10-13');
    const d1 = windowFor(s, '2026-10-14');
    expect(d1.opensAt).toEqual(at('2026-10-14', '20:00'));
    expect(d1.opensAt.getTime()).toBeLessThan(d.closesAt.getTime());
    expect(d.closesAt.getTime() - d1.opensAt.getTime()).toBe(4 * HOUR);
    for (let i = 0; i < 30; i++) {
      expect(closesAt(s, addDays(DAY0, i + 1)).getTime()).toBeGreaterThan(closesAt(s, addDays(DAY0, i)).getTime());
    }
  });

  it('only the earliest unsettled day is pending while the next one is open too', () => {
    const s = newGoal();
    const tuesdayEvening = at('2026-10-14', '21:00');
    expect(pendingWindow(s, tuesdayEvening)?.day).toBe('2026-10-13');
    expect(firstUpcomingDay(s, at('2026-10-14', '10:00'))).toBe('2026-10-14'); // today's hasn't arrived
    expect(firstUpcomingDay(s, tuesdayEvening)).toBe('2026-10-15');
    expect(firstUpcomingDay(s, at(DAY0, '12:00'))).toBe(DAY0);
    const answered = answerDay(s, DAY0, 'yes', { timeDay: '2026-10-14' }).state;
    expect(pendingWindow(answered, tuesdayEvening)?.day).toBe('2026-10-14');
  });

  it("drops the morning reminder when it would come with or after the next day's check-in", () => {
    // At check-in time, D+1's check-in already says yesterday's is still open: one notification.
    const same = setMorningTime(newGoal(), '20:00');
    expect(windowFor(same, DAY0).remindAt).toBeNull();
    const late = setMorningTime(newGoal(), '21:00');
    expect(windowFor(late, DAY0).remindAt).toBeNull();
    expect(windowFor(setMorningTime(newGoal(), '19:59'), DAY0).remindAt).toEqual(at('2026-10-14', '19:59'));
    expect(isMorningAtOrBeforeCheckIn('09:00', '20:00')).toBe(true);
    expect(isMorningAtOrBeforeCheckIn('20:00', '20:00')).toBe(true);
    expect(isMorningAtOrBeforeCheckIn('20:01', '20:00')).toBe(false);
  });

  it('is 29 hours long across the fall-back change and 27 hours across spring-forward', () => {
    const fall = windowFor(newGoal(), '2026-10-31');
    expect(fall.closesAt).toEqual(at('2026-11-02', '00:00'));
    expect(fall.closesAt.getTime() - fall.opensAt.getTime()).toBe(29 * HOUR);
    expect(fall.remindAt).toEqual(at('2026-11-01', '09:00')); // 09:00 MST, not shifted

    const spring = windowFor(newGoal({ day: '2027-03-10' }), '2027-03-13');
    expect(spring.closesAt.toISOString()).toBe('2027-03-15T06:00:00.000Z'); // 00:00 MDT
    expect(spring.closesAt.getTime() - spring.opensAt.getTime()).toBe(27 * HOUR);
    expect(spring.remindAt?.toISOString()).toBe('2027-03-14T15:00:00.000Z'); // 09:00 MDT
  });

  it('closes at the first instant of the day after, when its midnight falls in a DST gap', () => {
    // Santiago skips from 00:00 to 01:00 on Sep 6, 2026 (UTC-4 to UTC-3).
    const s = newGoal({ tz: SANTIAGO, day: '2026-09-01' });
    expect(closesAt(s, '2026-09-04').toISOString()).toBe('2026-09-06T04:00:00.000Z'); // 01:00 -03
    expect(closesAt(s, '2026-09-05').getTime()).toBeGreaterThan(closesAt(s, '2026-09-04').getTime());
  });

  it('closes at midnight ending D+1 whatever the check-in time', () => {
    const early = newGoal({ checkInTime: '00:15', morningTime: '00:00' });
    expect(windowFor(early, '2026-10-14').opensAt).toEqual(at('2026-10-14', '00:15'));
    expect(windowFor(early, '2026-10-14').closesAt).toEqual(at('2026-10-16', '00:00'));
    const late = newGoal({ checkInTime: '23:59' });
    expect(windowFor(late, DAY0).closesAt).toEqual(at('2026-10-15', '00:00'));
    expect(windowFor(late, '2026-10-14').opensAt).toEqual(at('2026-10-14', '23:59'));
  });
});

describe('the first goal day', () => {
  it('waits for check-in time when set up earlier in the day', () => {
    const s = newGoal({ time: '12:00' });
    expect(s.firstDay).toBe(DAY0);
    expect(pendingWindow(s, at(DAY0, '12:00'))).toBeNull();
    expect(nextWindow(s).opensAt).toEqual(at(DAY0, '20:00'));
    expect(pendingWindow(s, at(DAY0, '20:00'))?.day).toBe(DAY0);
  });

  it('is open straight away when set up after check-in time, until midnight ending the next day', () => {
    const s = newGoal({ time: '22:15' });
    expect(pendingWindow(s, at(DAY0, '22:15'))?.day).toBe(DAY0);
    expect(pendingWindow(s, at('2026-10-14', '23:59'))?.day).toBe(DAY0);
    expect(nextWindow(s).closesAt).toEqual(at('2026-10-15', '00:00'));
  });

  it('has no days before setup, even after midnight', () => {
    const s = newGoal({ time: '00:30', day: '2026-10-14' });
    expect(s.firstDay).toBe('2026-10-14');
    // Yesterday's window would be open at 00:30, but yesterday isn't a goal day.
    const { state, events } = resolve(s, at('2026-10-14', '00:30'), DENVER);
    expect(events).toEqual([]);
    expect(pendingWindow(state, at('2026-10-14', '00:30'))).toBeNull();
  });

  it('validates its inputs', () => {
    const base = { goalId: 'g', goal: 'Read', now: at(DAY0, '12:00'), tz: DENVER };
    expect(() => createGoal({ ...base, goal: '   ' })).toThrow(RangeError);
    expect(() => createGoal({ ...base, checkInTime: '8pm' })).toThrow(RangeError);
    expect(() => createGoal({ ...base, tz: 'Nowhere/Land' })).toThrow(RangeError);
    expect(createGoal({ ...base, goal: '  Read 20 minutes ' }).goal).toBe('Read 20 minutes');
  });
});

describe('today vs yesterday copy', () => {
  it('is "today" in the evening and "yesterday" all the next day', () => {
    const s = newGoal();
    const evening = pendingWindow(s, at(DAY0, '21:00'));
    const morning = pendingWindow(s, at('2026-10-14', '09:30'));
    const nextEvening = pendingWindow(s, at('2026-10-14', '23:00'));
    expect(evening && isWindowToday(evening, at(DAY0, '21:00'))).toBe(true);
    expect(morning?.day).toBe(DAY0);
    expect(morning && isWindowToday(morning, at('2026-10-14', '09:30'))).toBe(false);
    expect(nextEvening?.day).toBe(DAY0);
    expect(nextEvening && isWindowToday(nextEvening, at('2026-10-14', '23:00'))).toBe(false);
  });
});
