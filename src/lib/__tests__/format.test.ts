import { describe, expect, it } from '@jest/globals';

import { at, DENVER, iso, TOKYO } from '@/engine/__tests__/fixtures';

import { formatClockTime, formatDayShort, formatMonth, formatWhen, plural, relativeDay } from '../format';

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

  it('formats short days, months and plurals', () => {
    expect(formatDayShort('2026-10-03')).toBe('Oct 3');
    expect(formatMonth('2026-10')).toBe('October 2026');
    expect(plural(1, 'zero')).toBe('1 zero');
    expect(plural(3, 'zero')).toBe('3 zeros');
  });
});
