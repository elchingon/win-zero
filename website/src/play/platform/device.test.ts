import { describe, expect, it } from 'vitest';

import { firstWeekday, uses24HourClock } from './device';

describe('device calendar', () => {
  it('reads the clock style from the locale', () => {
    expect(uses24HourClock('en-US')).toBe(false);
    expect(uses24HourClock('en-GB')).toBe(true);
  });

  it('counts the first weekday from Sunday = 1, as the app does', () => {
    const us = firstWeekday('en-US');
    const de = firstWeekday('de-DE');
    // Where the runtime knows week info: Sunday in the US, Monday in Germany. Otherwise Sunday.
    expect(us).toBe(1);
    expect([1, 2]).toContain(de);
  });
});
