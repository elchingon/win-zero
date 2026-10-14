import { describe, expect, it } from '@jest/globals';

import { addMonths, monthGrid, monthOf, weekdayInitials } from '../calendar';

describe('calendar', () => {
  it('lays out a month starting on Sunday or Monday', () => {
    const sunday = monthGrid('2026-10', 1); // Oct 1 2026 is a Thursday
    expect(sunday[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03']);
    expect(sunday.at(-1)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
    expect(sunday.flat().filter(Boolean)).toHaveLength(31);

    const monday = monthGrid('2026-10', 2);
    expect(monday[0]?.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(monday.every((week) => week.length === 7)).toBe(true);
    expect(monthGrid('2028-02', 1).flat().filter(Boolean)).toHaveLength(29);
  });

  it('steps months across years', () => {
    expect(monthOf('2026-10-13')).toBe('2026-10');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', -14)).toBe('2025-08');
  });

  it('labels weekdays from the first day of the week', () => {
    expect(weekdayInitials(1)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(weekdayInitials(2)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  });
});
