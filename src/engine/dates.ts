// Calendar and time-zone math. Every function is a pure function of its arguments: results
// never depend on the device's own time zone. Zone lookups go through Intl directly because
// date-fns-tz's helpers read the device's local time (toUtcDate / setHours).
import type { ClockTime, DayKey, TimeZone } from './types';

export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface Ymd {
  y: number;
  m: number;
  d: number;
}

function parseDayKey(day: DayKey): Ymd {
  const match = DAY_KEY_RE.exec(day);
  if (!match) throw new RangeError(`Invalid day key: ${day}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`Invalid day key: ${day}`);
  }
  return { y, m, d };
}

function parseClockTime(time: ClockTime): { h: number; min: number } {
  const match = CLOCK_RE.exec(time);
  if (!match) throw new RangeError(`Invalid clock time: ${time}`);
  return { h: Number(match[1]), min: Number(match[2]) };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function formatDayKey(y: number, m: number, d: number): DayKey {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

export function isValidDayKey(day: string): boolean {
  try {
    parseDayKey(day);
    return true;
  } catch {
    return false;
  }
}

export function isValidClockTime(time: string): boolean {
  return CLOCK_RE.test(time);
}

/** Minutes after midnight for an 'HH:mm' time. */
export function clockMinutes(time: ClockTime): number {
  const { h, min } = parseClockTime(time);
  return h * 60 + min;
}

export function addDays(day: DayKey, n: number): DayKey {
  const { y, m, d } = parseDayKey(day);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return formatDayKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Whole calendar days from `b` to `a` (positive when a is later). */
export function diffDays(a: DayKey, b: DayKey): number {
  const pa = parseDayKey(a);
  const pb = parseDayKey(b);
  return Math.round((Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d)) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------------------
// Time zones

const formatters = new Map<TimeZone, Intl.DateTimeFormat>();

function formatterFor(tz: TimeZone): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    formatterFor(tz);
    return true;
  } catch {
    return false;
  }
}

interface WallParts extends Ymd {
  h: number;
  min: number;
  s: number;
}

function wallPartsAt(instantMs: number, tz: TimeZone): WallParts {
  const out: Record<string, number> = {};
  for (const p of formatterFor(tz).formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    y: out.year ?? NaN,
    m: out.month ?? NaN,
    d: out.day ?? NaN,
    // Some engines print midnight as hour 24 when hour12 is false.
    h: (out.hour ?? NaN) % 24,
    min: out.minute ?? NaN,
    s: out.second ?? NaN,
  };
}

/** UTC offset of `tz` at an instant, in ms (positive east of Greenwich). */
export function zoneOffsetMs(instantMs: number, tz: TimeZone): number {
  const p = wallPartsAt(instantMs, tz);
  const wallAsUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  const wholeSecond = instantMs - (((instantMs % 1000) + 1000) % 1000);
  return wallAsUtc - wholeSecond;
}

/** The local calendar date in `tz` at an instant. */
export function dayKeyAt(instant: Date, tz: TimeZone): DayKey {
  const p = wallPartsAt(instant.getTime(), tz);
  return formatDayKey(p.y, p.m, p.d);
}

/**
 * The instant at which the clock in `tz` reads `time` on `day`.
 *
 * - Spring-forward gap (the time doesn't exist): moves forward by the gap, so 02:30 becomes
 *   03:30 on a one-hour change.
 * - Fall-back overlap (the time happens twice): the earlier instant.
 */
export function wallTimeToInstant(day: DayKey, time: ClockTime, tz: TimeZone): Date {
  const { y, m, d } = parseDayKey(day);
  const { h, min } = parseClockTime(time);
  const wallAsUtc = Date.UTC(y, m - 1, d, h, min);
  // Offsets a day either side bracket any transition near this wall time.
  const before = zoneOffsetMs(wallAsUtc - MS_PER_DAY, tz);
  const after = zoneOffsetMs(wallAsUtc + MS_PER_DAY, tz);
  const valid = [before, after]
    .map((offset) => wallAsUtc - offset)
    .filter((t) => zoneOffsetMs(t, tz) === wallAsUtc - t);
  if (valid.length > 0) return new Date(Math.min(...valid));
  // In a gap: read the wall time with the pre-transition offset, which lands after the gap.
  return new Date(wallAsUtc - before);
}
