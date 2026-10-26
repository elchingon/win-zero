import { describe, expect, it } from '@jest/globals';

import { at, DENVER, iso, TOKYO } from '@/engine/__tests__/fixtures';

import {
  formatClockTime,
  formatCount,
  formatDayRange,
  formatDays,
  formatDayShort,
  formatMonth,
  formatUntil,
  formatWhen,
  parseCount,
  plural,
  relativeDay,
} from '../format';

describe('format', () => {
  it('formats clock times for 12- and 24-hour devices', () => {
    expect(formatClockTime('20:00', false)).toBe('8:00 PM');
    expect(formatClockTime('00:05', false)).toBe('12:05 AM');
    expect(formatClockTime('12:30', false)).toBe('12:30 PM');
    expect(formatClockTime('09:00', true)).toBe('09:00');
  });

  it('names days relative to today', () => {
    expect(relativeDay('2026-10-13', '2026-10-13')).toBe('today');
    expect(relativeDay('2026-10-14', '2026-10-13')).toBe('tomorrow');
    expect(relativeDay('2026-10-12', '2026-10-13')).toBe('yesterday');
    expect(relativeDay('2026-10-16', '2026-10-13')).toBe('Friday');
    expect(relativeDay('2026-11-02', '2026-10-13')).toBe('Nov 2');
  });

  it('says when an instant happens on the clock of the given zone', () => {
    expect(formatWhen(at('2026-10-14', '20:00'), at('2026-10-13', '21:00'), DENVER, false)).toBe(
      'tomorrow at 8:00 PM',
    );
    // The same instant is 11:00 the day after in Tokyo.
    expect(formatWhen(iso('2026-10-15T02:00:00Z'), iso('2026-10-14T03:00:00Z'), TOKYO, true)).toBe('tomorrow at 11:00');
  });

  it('says a midnight deadline as the end of a day, and anything else like formatWhen', () => {
    const close = at('2026-10-15', '00:00'); // the end of 10-14
    expect(formatUntil(close, at('2026-10-14', '21:00'), DENVER, false)).toBe('the end of today');
    expect(formatUntil(close, at('2026-10-13', '20:00'), DENVER, false)).toBe('the end of tomorrow');
    expect(formatUntil(close, at('2026-10-11', '20:00'), DENVER, false)).toBe('the end of Wednesday');
    // On another zone's clock it isn't midnight, so it says the time.
    expect(formatUntil(close, at('2026-10-14', '21:00'), TOKYO, true)).toBe('today at 15:00');
    expect(formatUntil(at('2026-10-15', '03:00'), at('2026-10-14', '21:00'), DENVER, false)).toBe('tomorrow at 3:00 AM');
  });

  it('formats short days, months and plurals', () => {
    expect(formatDayShort('2026-10-03')).toBe('Oct 3');
    expect(formatDayRange('2026-10-02', '2026-10-15', '2026-11-20')).toBe('Oct 2 – Oct 15');
    expect(formatDayRange('2026-10-02', '2026-10-15', '2026-11-20', ' to ')).toBe('Oct 2 to Oct 15');
    expect(formatDayRange('2026-10-02', '2026-10-02', '2026-10-02')).toBe('Oct 2');
    // Years when it isn't all this year's.
    expect(formatDayRange('2025-12-28', '2026-01-03', '2026-01-03')).toBe('Dec 28, 2025 – Jan 3, 2026');
    expect(formatDayRange('2025-03-01', '2025-03-09', '2026-10-15')).toBe('Mar 1, 2025 – Mar 9, 2025');
    expect(formatMonth('2026-10')).toBe('October 2026');
    expect(plural(1, 'zero')).toBe('1 zero');
    expect(plural(3, 'zero')).toBe('3 zeros');
  });

  it('groups big counts with commas', () => {
    expect([formatCount(7), formatCount(501), formatCount(1000), formatCount(100000)]).toEqual(['7', '501', '1,000', '100,000']);
  });
});

describe('formatDays', () => {
  /** expo-localization's numbering: 1 = Sunday, 2 = Monday. */
  const SUNDAY_FIRST = 1;
  const MONDAY_FIRST = 2;

  it('names every day, weekdays and weekends in words', () => {
    expect(formatDays(undefined, SUNDAY_FIRST)).toBe('Every day');
    expect(formatDays([0, 1, 2, 3, 4, 5, 6], MONDAY_FIRST)).toBe('Every day');
    expect(formatDays([5, 1, 3, 2, 4], SUNDAY_FIRST)).toBe('Weekdays');
    expect(formatDays([6, 0], MONDAY_FIRST)).toBe('Weekends');
  });

  it('names a single day by its weekday', () => {
    expect(formatDays([0], MONDAY_FIRST)).toBe('Sundays');
    expect(formatDays([3, 3], SUNDAY_FIRST)).toBe('Wednesdays');
  });

  it('lists any other days short, in the order the week starts on this phone', () => {
    expect(formatDays([5, 1, 3], MONDAY_FIRST)).toBe('Mon, Wed, Fri');
    expect(formatDays([1, 3, 5], SUNDAY_FIRST)).toBe('Mon, Wed, Fri');
    expect(formatDays([0, 2], SUNDAY_FIRST)).toBe('Sun, Tue');
    expect(formatDays([0, 2], MONDAY_FIRST)).toBe('Tue, Sun');
    expect(formatDays([6, 0, 1], 7)).toBe('Sat, Sun, Mon');
  });

  it('turns down a schedule with no days', () => {
    expect(() => formatDays([], SUNDAY_FIRST)).toThrow();
  });
});

describe('parseCount', () => {
  it('takes whole numbers from 1 to max only', () => {
    expect(parseCount('30', 1000)).toBe(30);
    expect(parseCount('1000', 1000)).toBe(1000);
    for (const bad of ['', '0', '1001', '2.5', '-3', '1e3', ' 4', '1,000']) expect(parseCount(bad, 1000)).toBeNull();
  });
});
