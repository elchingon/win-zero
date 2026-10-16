import { describe, expect, it } from '@jest/globals';

import { seeded } from '@/engine/__tests__/fixtures';

import { cheerDeck, CHEERS } from '../cheers';

/** Lines about drinking or drugs, or that frame a day as a failure, don't belong here. */
const OFF_TONE = /\b(drink\w*|drunk|shots?|cheers|toast|wasted|loaded|high|buzz\w*|bombed|smashed|fail\w*|lose|lost|broke\w*)\b/i;
/** About two lines on a phone. */
const MAX_LENGTH = 64;

const deal = (random: () => number, count: number) => {
  const next = cheerDeck(random);
  return Array.from({ length: count }, () => next());
};

describe('CHEERS', () => {
  it('has 10 to 20 different lines, each short enough for the popup', () => {
    expect(CHEERS.length).toBeGreaterThanOrEqual(10);
    expect(CHEERS.length).toBeLessThanOrEqual(20);
    expect(new Set(CHEERS).size).toBe(CHEERS.length);
    for (const line of CHEERS) expect(line.length).toBeLessThanOrEqual(MAX_LENGTH);
  });

  it('stays supportive', () => {
    for (const line of CHEERS) expect(line).not.toMatch(OFF_TONE);
  });
});

describe('cheerDeck', () => {
  it('shows every line once before any repeats', () => {
    for (const seed of [1, 3, 42]) {
      const first = deal(seeded(seed), CHEERS.length);
      expect([...first].sort()).toEqual([...CHEERS].sort());
    }
  });

  it('never shows the same line twice in a row, across reshuffles', () => {
    const randoms = [seeded(3), seeded(7), () => 0, () => 0.999999];
    for (const random of randoms) {
      const lines = deal(random, CHEERS.length * 5);
      for (let i = 1; i < lines.length; i++) expect(lines[i]).not.toBe(lines[i - 1]);
    }
  });

  it('shuffles: different randomness, different order', () => {
    expect(deal(seeded(1), CHEERS.length)).not.toEqual(deal(seeded(2), CHEERS.length));
  });
});
