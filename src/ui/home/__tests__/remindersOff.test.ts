// When Home shows the reminders-off card.
import { describe, expect, it } from '@jest/globals';

import { MS_PER_DAY } from '@/engine';

import { remindersCardVisible } from '../remindersOff';

const NOW = new Date('2026-10-15T03:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

describe('reminders-off card', () => {
  it('shows while reminders were never turned on, or are off in system settings', () => {
    expect(remindersCardVisible('undetermined', null, NOW)).toBe(true);
    expect(remindersCardVisible('denied', null, NOW)).toBe(true);
  });

  it('stays away while reminders are on, or before the permission has been read', () => {
    expect(remindersCardVisible('granted', null, NOW)).toBe(false);
    expect(remindersCardVisible(null, null, NOW)).toBe(false);
  });

  it('stays hidden after Not now until the time it was hidden until', () => {
    expect(remindersCardVisible('undetermined', later(7 * MS_PER_DAY), NOW)).toBe(false);
    expect(remindersCardVisible('denied', later(1), NOW)).toBe(false);
    expect(remindersCardVisible('denied', later(0), NOW)).toBe(true);
    expect(remindersCardVisible('undetermined', later(-MS_PER_DAY), NOW)).toBe(true);
  });
});
