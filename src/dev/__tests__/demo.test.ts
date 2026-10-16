import { describe, expect, it } from '@jest/globals';

import { createGoal, MS_PER_DAY, MS_PER_HOUR } from '@/engine';

import { debugReadout, offsetLabel, parseCount } from '../demo';

describe('offsetLabel', () => {
  it('reads the debug offset in days and hours', () => {
    expect(offsetLabel(0)).toBe('real time');
    expect(offsetLabel(MS_PER_HOUR)).toBe('+0d 1h');
    expect(offsetLabel(2 * MS_PER_DAY + 3 * MS_PER_HOUR)).toBe('+2d 3h');
  });
});

describe('parseCount', () => {
  it('takes whole numbers from 1 to max only', () => {
    expect(parseCount('30', 1000)).toBe(30);
    expect(parseCount('1000', 1000)).toBe(1000);
    for (const bad of ['', '0', '1001', '2.5', '-3', '1e3', ' 4']) expect(parseCount(bad, 1000)).toBeNull();
  });
});

describe('debugReadout', () => {
  it('shows the clock, zone and streak, and the open or next check-in', () => {
    const tz = 'America/Denver';
    const now = new Date('2026-10-15T15:00:00Z'); // 09:00 in Denver
    const goal = createGoal({ goalId: 'g', goal: 'Read', checkInTime: '20:00', morningTime: '09:00', now, tz });
    expect(debugReadout(goal, now, tz, 0)).toEqual([
      'Now 2026-10-15 09:00 (real time)',
      'Zone America/Denver',
      'Streak 0 · slide 0 · missed in a row 0',
      'Next opens 2026-10-15 20:00',
    ]);
    expect(debugReadout(null, now, tz, 0)).toEqual(['Now 2026-10-15 09:00 (real time)', 'Zone America/Denver', 'No goal']);
  });
});
