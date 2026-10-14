import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  clockMinutes,
  dayKeyAt,
  diffDays,
  isValidClockTime,
  isValidDayKey,
  isValidTimeZone,
  wallTimeToInstant,
  zoneOffsetMs,
} from '../dates';
import { DENVER, iso, LONDON, TOKYO } from './fixtures';

describe('day keys', () => {
  it('adds days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-13', 365)).toBe('2027-10-13');
  });

  it('counts whole days between keys, including across DST dates', () => {
    expect(diffDays('2026-11-05', '2026-10-28')).toBe(8);
    expect(diffDays('2027-03-15', '2027-03-13')).toBe(2);
    expect(diffDays('2026-10-13', '2026-10-14')).toBe(-1);
  });

  it('rejects malformed or impossible dates', () => {
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('2026-1-01')).toBe(false);
    expect(isValidDayKey('2026-02-28')).toBe(true);
    expect(() => addDays('2026-13-01', 1)).toThrow(RangeError);
  });
});

describe('clock times', () => {
  it('accepts 24h HH:mm only', () => {
    expect(isValidClockTime('20:00')).toBe(true);
    expect(isValidClockTime('00:00')).toBe(true);
    expect(isValidClockTime('23:59')).toBe(true);
    expect(isValidClockTime('24:00')).toBe(false);
    expect(isValidClockTime('7:00')).toBe(false);
    expect(isValidClockTime('07:60')).toBe(false);
    expect(clockMinutes('20:30')).toBe(1230);
  });
});

describe('time zones', () => {
  it('validates IANA names', () => {
    expect(isValidTimeZone(DENVER)).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });

  it('reads the local date of an instant in any zone', () => {
    const instant = iso('2026-10-14T05:00:00Z');
    expect(dayKeyAt(instant, DENVER)).toBe('2026-10-13'); // 23:00 MDT
    expect(dayKeyAt(instant, TOKYO)).toBe('2026-10-14'); // 14:00 JST
    expect(dayKeyAt(iso('2026-10-14T06:00:00Z'), DENVER)).toBe('2026-10-14'); // midnight MDT
  });

  it('reports zone offsets on both sides of a change', () => {
    expect(zoneOffsetMs(Date.parse('2026-10-31T12:00:00Z'), DENVER)).toBe(-6 * 3_600_000);
    expect(zoneOffsetMs(Date.parse('2026-11-02T12:00:00Z'), DENVER)).toBe(-7 * 3_600_000);
    expect(zoneOffsetMs(Date.parse('2026-10-13T12:00:00Z'), 'Pacific/Chatham')).toBe(13.75 * 3_600_000);
  });
});

describe('wallTimeToInstant', () => {
  it('converts an ordinary local time', () => {
    expect(wallTimeToInstant('2026-10-13', '20:00', DENVER).toISOString()).toBe('2026-10-14T02:00:00.000Z');
    expect(wallTimeToInstant('2026-11-02', '20:00', DENVER).toISOString()).toBe('2026-11-03T03:00:00.000Z');
    expect(wallTimeToInstant('2026-10-13', '20:00', 'Pacific/Chatham').toISOString()).toBe(
      '2026-10-13T06:15:00.000Z',
    );
  });

  it('moves a time inside the spring-forward gap forward', () => {
    // Denver, 2027-03-14: 02:00 MST jumps to 03:00 MDT.
    expect(wallTimeToInstant('2027-03-14', '02:30', DENVER).toISOString()).toBe('2027-03-14T09:30:00.000Z'); // 03:30 MDT
    expect(wallTimeToInstant('2027-03-14', '02:00', DENVER).toISOString()).toBe('2027-03-14T09:00:00.000Z'); // 03:00 MDT
    expect(wallTimeToInstant('2027-03-14', '03:00', DENVER).toISOString()).toBe('2027-03-14T09:00:00.000Z');
    // London, 2027-03-28: 01:00 GMT jumps to 02:00 BST.
    expect(wallTimeToInstant('2027-03-28', '01:30', LONDON).toISOString()).toBe('2027-03-28T01:30:00.000Z'); // 02:30 BST
  });

  it('takes the earlier instant for a time that happens twice in the fall-back overlap', () => {
    // Denver, 2026-11-01: 02:00 MDT falls back to 01:00 MST.
    expect(wallTimeToInstant('2026-11-01', '01:30', DENVER).toISOString()).toBe('2026-11-01T07:30:00.000Z'); // MDT
    // London, 2026-10-25: 02:00 BST falls back to 01:00 GMT.
    expect(wallTimeToInstant('2026-10-25', '01:30', LONDON).toISOString()).toBe('2026-10-25T00:30:00.000Z'); // BST
  });

  it('round-trips every quarter hour of a DST change day', () => {
    // [day, zone, first and last+1 minute of the skipped hour, or null on a fall-back day]
    const cases = [
      ['2026-11-01', DENVER, null],
      ['2027-03-14', DENVER, [120, 180]],
      ['2026-10-25', LONDON, null],
      ['2027-03-28', LONDON, [60, 120]],
    ] as const;
    for (const [day, tz, gap] of cases) {
      for (let m = 0; m < 24 * 60; m += 15) {
        const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const instant = wallTimeToInstant(day, time, tz);
        const wall = new Date(instant.getTime() + zoneOffsetMs(instant.getTime(), tz));
        const wallMinutes = wall.getUTCHours() * 60 + wall.getUTCMinutes();
        const skipped = gap !== null && m >= gap[0] && m < gap[1];
        expect(dayKeyAt(instant, tz)).toBe(day);
        expect(wallMinutes).toBe(skipped ? m + 60 : m);
      }
    }
  });
});
