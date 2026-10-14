import { describe, expect, it } from '@jest/globals';

import { createGoal, resolve, setMorningTime } from '../resolve';
import {
  isMorningBeforeCheckIn,
  isWindowToday,
  nextWindow,
  pendingWindow,
  windowFor,
} from '../windows';
import { at, DAY0, DENVER, newGoal } from './fixtures';

const HOUR = 3_600_000;

describe('windowFor (SPEC 2)', () => {
  it('opens at check-in time on D, reminds the next morning, and closes at check-in on D+1', () => {
    const w = windowFor(newGoal(), DAY0);
    expect(w.day).toBe(DAY0);
    expect(w.tz).toBe(DENVER);
    expect(w.opensAt).toEqual(at('2026-10-13', '20:00'));
    expect(w.remindAt).toEqual(at('2026-10-14', '09:00'));
    expect(w.closesAt).toEqual(at('2026-10-14', '20:00'));
  });

  it('chains windows: each one closes exactly when the next opens', () => {
    const s = newGoal();
    expect(windowFor(s, '2026-10-13').closesAt).toEqual(windowFor(s, '2026-10-14').opensAt);
  });

  it('drops the morning reminder when it would fall outside the window', () => {
    const late = setMorningTime(newGoal(), '21:00');
    expect(windowFor(late, DAY0).remindAt).toBeNull();
    const same = setMorningTime(newGoal(), '20:00');
    expect(windowFor(same, DAY0).remindAt).toBeNull();
    expect(isMorningBeforeCheckIn('09:00', '20:00')).toBe(true);
    expect(isMorningBeforeCheckIn('20:00', '20:00')).toBe(false);
  });

  it('is 25 hours long across the fall-back change and 23 hours across spring-forward', () => {
    const fall = windowFor(newGoal(), '2026-10-31');
    expect(fall.closesAt.getTime() - fall.opensAt.getTime()).toBe(25 * HOUR);
    expect(fall.remindAt).toEqual(at('2026-11-01', '09:00')); // 09:00 MST, not shifted

    const spring = windowFor(newGoal({ day: '2027-03-10' }), '2027-03-13');
    expect(spring.closesAt.getTime() - spring.opensAt.getTime()).toBe(23 * HOUR);
    expect(spring.remindAt?.toISOString()).toBe('2027-03-14T15:00:00.000Z'); // 09:00 MDT
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

  it('is open straight away when set up after check-in time', () => {
    const s = newGoal({ time: '22:15' });
    expect(pendingWindow(s, at(DAY0, '22:15'))?.day).toBe(DAY0);
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
  it('is "today" in the evening and "yesterday" the next morning', () => {
    const s = newGoal();
    const evening = pendingWindow(s, at(DAY0, '21:00'));
    const morning = pendingWindow(s, at('2026-10-14', '09:30'));
    expect(evening && isWindowToday(evening, at(DAY0, '21:00'))).toBe(true);
    expect(morning?.day).toBe(DAY0);
    expect(morning && isWindowToday(morning, at('2026-10-14', '09:30'))).toBe(false);
  });
});
