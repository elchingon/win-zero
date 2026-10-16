// What the browser says about time and calendars. Read fresh each call: a laptop can travel.
import { isValidTimeZone, type TimeZone } from '@/engine';

export function browserTimeZone(): TimeZone {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidTimeZone(zone) ? zone : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Whether this locale shows a 24-hour clock. */
export function uses24HourClock(locale?: string): boolean {
  try {
    const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return cycle === 'h23' || cycle === 'h24';
  } catch {
    return false;
  }
}

interface WeekInfo {
  firstDay: number;
}

/**
 * The first day of the week, 1 = Sunday … 7 = Saturday, as the app's calendar counts. Intl's
 * week info counts 1 = Monday … 7 = Sunday; browsers without it get Sunday.
 */
export function firstWeekday(locale?: string): number {
  try {
    const l = new Intl.Locale(locale ?? navigator.language) as Intl.Locale & {
      getWeekInfo?: () => WeekInfo;
      weekInfo?: WeekInfo;
    };
    const firstDay = (l.getWeekInfo?.() ?? l.weekInfo)?.firstDay;
    return firstDay && firstDay >= 1 && firstDay <= 7 ? (firstDay % 7) + 1 : 1;
  } catch {
    return 1;
  }
}
