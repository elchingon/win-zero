// Month grids for the history calendar.
import { addDays, weekdayOf, type DayKey } from '@/engine';

/** 'YYYY-MM'. */
export type MonthKey = string;

export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7);
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y = 1970, m = 1] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + n;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * Weeks of the month, each 7 cells starting on `firstWeekday` (1 = Sunday … 7 = Saturday,
 * as expo-localization reports it). Cells outside the month are null.
 */
export function monthGrid(month: MonthKey, firstWeekday: number): (DayKey | null)[][] {
  const first = `${month}-01`;
  const start = (weekdayOf(first) - (firstWeekday - 1) + 7) % 7;
  const cells: (DayKey | null)[] = Array.from({ length: start }, () => null);
  for (let day = first; monthOf(day) === month; day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

const INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function weekdayInitials(firstWeekday: number): string[] {
  return Array.from({ length: 7 }, (_, i) => INITIALS[(firstWeekday - 1 + i) % 7] ?? '');
}
