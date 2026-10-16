// The browser's clock style and first weekday, read once: they come from the language setting.
import { firstWeekday, uses24HourClock } from './device';

let cached: { h24: boolean; firstWeekday: number } | null = null;

export function deviceCalendar(): { h24: boolean; firstWeekday: number } {
  cached ??= { h24: uses24HourClock(), firstWeekday: firstWeekday() };
  return cached;
}
