// Display formatting. Rules live in the engine; this only turns its values into words, and reads
// back the numbers a player types.
import {
  addDays,
  clockMinutes,
  clockTimeAt,
  dayKeyAt,
  diffDays,
  normalizeDays,
  weekdayOf,
  type ClockTime,
  type DayKey,
  type TimeZone,
} from '@/engine';

const pad = (n: number) => String(n).padStart(2, '0');

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** '20:00' → '8:00 PM', or '20:00' on a 24-hour device. */
export function formatClockTime(time: ClockTime, h24: boolean): string {
  const total = clockMinutes(time);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h24) return `${pad(h)}:${pad(m)}`;
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** The time an instant shows on a clock in `tz`. */
export function formatInstantTime(instant: Date, tz: TimeZone, h24: boolean): string {
  return formatClockTime(clockTimeAt(instant, tz), h24);
}

/** 'today', 'tomorrow', 'yesterday', or the weekday name within the week either side. */
export function relativeDay(day: DayKey, today: DayKey): string {
  const diff = diffDays(day, today);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (Math.abs(diff) < 7) return WEEKDAYS[weekdayOf(day)] ?? day;
  return formatDayShort(day);
}

/** 'tomorrow at 8:00 PM', judged by the calendar in `tz`. */
export function formatWhen(instant: Date, now: Date, tz: TimeZone, h24: boolean): string {
  return `${relativeDay(dayKeyAt(instant, tz), dayKeyAt(now, tz))} at ${formatInstantTime(instant, tz, h24)}`;
}

/**
 * A deadline: 'the end of today' when it falls on midnight on the clock in `tz`, which reads
 * better than '12:00 AM tomorrow'. Any other instant reads like formatWhen.
 */
export function formatUntil(instant: Date, now: Date, tz: TimeZone, h24: boolean): string {
  if (clockTimeAt(instant, tz) !== '00:00') return formatWhen(instant, now, tz, h24);
  return `the end of ${relativeDay(addDays(dayKeyAt(instant, tz), -1), dayKeyAt(now, tz))}`;
}

/** 'Oct 13'. */
export function formatDayShort(day: DayKey): string {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]?.slice(0, 3)} ${d}`;
}

/**
 * 'Oct 2 – Oct 15'. Years show when the range isn't all in `today`'s year:
 * 'Dec 28, 2025 – Jan 3, 2026'. Screen readers get `sep` ' to ' rather than a dash.
 */
export function formatDayRange(from: DayKey, to: DayKey, today: DayKey, sep = ' – '): string {
  const year = today.slice(0, 4);
  const withYear = from.slice(0, 4) !== year || to.slice(0, 4) !== year;
  const one = (day: DayKey) => (withYear ? `${formatDayShort(day)}, ${day.slice(0, 4)}` : formatDayShort(day));
  return from === to ? one(from) : `${one(from)}${sep}${one(to)}`;
}

/** 'October 2026' for a 'YYYY-MM' month key. */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** '1 zero', '3 zeros'. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Monday to Friday, and Saturday and Sunday (0 = Sunday … 6 = Saturday). */
const WORK_WEEK = '1,2,3,4,5';
const WEEKEND = '0,6';

/**
 * A goal's check-in days (SPEC 9): 'Every day', 'Weekdays', 'Weekends', 'Sundays' for one day, or
 * 'Mon, Wed, Fri' in week order. `days` are 0 = Sunday … 6 = Saturday, absent for every day, as the
 * engine keeps them; the week starts on `firstWeekday` (1 = Sunday … 7 = Saturday, as
 * expo-localization reports it, like the history calendar). Throws for an empty list.
 */
export function formatDays(days: readonly number[] | undefined, firstWeekday: number): string {
  const set = normalizeDays(days);
  if (!set) return 'Every day';
  const key = set.join(',');
  if (key === WORK_WEEK) return 'Weekdays';
  if (key === WEEKEND) return 'Weekends';
  if (set.length === 1) return `${WEEKDAYS[set[0] ?? 0]}s`;
  const place = (d: number) => (d - (firstWeekday - 1) + 7) % 7;
  return [...set]
    .sort((a, b) => place(a) - place(b))
    .map((d) => WEEKDAYS[d]?.slice(0, 3))
    .join(', ');
}

/** 'a', 'a and b', 'a, b and c'. */
export function joinAnd(parts: readonly string[]): string {
  return parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** '1,000': grouped the way the rest of the (English) copy reads, in characters Bungee has. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** A whole number from 1 to `max`, typed as plain digits, or null. */
export function parseCount(text: string, max: number): number | null {
  const n = Number(text);
  return /^\d+$/.test(text) && n >= 1 && n <= max ? n : null;
}
