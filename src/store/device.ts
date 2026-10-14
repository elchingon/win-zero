// What the device says about time. Read fresh each call: Android doesn't announce time zone
// changes, so the app asks again whenever it comes to the foreground.
import { getCalendars } from 'expo-localization';

import { isValidTimeZone, type TimeZone } from '@/engine';

export function deviceTimeZone(): TimeZone {
  const fromCalendar = getCalendars()[0]?.timeZone;
  if (fromCalendar && isValidTimeZone(fromCalendar)) return fromCalendar;
  const fromIntl = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return fromIntl && isValidTimeZone(fromIntl) ? fromIntl : 'UTC';
}

export function deviceUses24HourClock(): boolean {
  return getCalendars()[0]?.uses24hourClock ?? false;
}

/** 1 = Sunday … 7 = Saturday. */
export function deviceFirstWeekday(): number {
  return getCalendars()[0]?.firstWeekday ?? 1;
}
