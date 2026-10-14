import { useCalendars } from 'expo-localization';

/** The device's clock style and first day of the week (1 = Sunday). */
export function useDeviceCalendar(): { h24: boolean; firstWeekday: number } {
  const calendar = useCalendars()[0];
  return { h24: calendar?.uses24hourClock ?? false, firstWeekday: calendar?.firstWeekday ?? 1 };
}
