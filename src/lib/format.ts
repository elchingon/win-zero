// Display formatting. Rules live in the engine; this only turns its values into words.
import { clockMinutes, clockTimeAt, dayKeyAt, diffDays, weekdayOf, type ClockTime, type DayKey, type TimeZone } from '@/engine';

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

/** 'Oct 13'. */
export function formatDayShort(day: DayKey): string {
  const [, m, d] = day.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]?.slice(0, 3)} ${d}`;
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

/** '1,000': grouped the way the rest of the (English) copy reads, in characters Bungee has. */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}
