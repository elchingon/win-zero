// A comeback's words (SPEC 9): supportive, short enough for the popup, and never how long it was.
import { describe, expect, it } from '@jest/globals';

import { COMEBACK_CHEERS } from '../copy';

/** As the usual cheers: nothing about drinking, and nothing that frames a day as a failure. */
const OFF_TONE = /\b(drink\w*|drunk|shots?|cheers|toast|wasted|loaded|high|buzz\w*|bombed|smashed|fail\w*|lose|lost|broke\w*)\b/i;
/** A line that counts the time away. */
const COUNTS = /\d|\b(days?|weeks?|months?|again and again)\b/i;

describe('COMEBACK_CHEERS', () => {
  it('has a handful of different lines, each short enough for the popup', () => {
    expect(COMEBACK_CHEERS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(COMEBACK_CHEERS).size).toBe(COMEBACK_CHEERS.length);
    for (const line of COMEBACK_CHEERS) expect(line.length).toBeLessThanOrEqual(64);
  });

  it('stays supportive, and never counts the time away', () => {
    for (const line of COMEBACK_CHEERS) {
      expect(line).not.toMatch(OFF_TONE);
      expect(line).not.toMatch(COUNTS);
    }
  });
});
