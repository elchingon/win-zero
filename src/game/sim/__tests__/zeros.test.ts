// Energy zeros (days 1–7) and armored zeros (days 61+): HP, hit flashes, bursts and badges.
import { describe, expect, it } from '@jest/globals';

import { composeRound } from '@/engine';

import { armorBadges } from '../badges';
import { ARMOR_BURST_SCALE, HIT_SPARKS, KILL_FRAGMENTS_BUSY, KILL_SPARKS_BUSY } from '../constants';
import { damageZero, killZero } from '../damage';
import { game, popIn } from './fixtures';

describe('energy zeros', () => {
  it('flash and throw a few sparks on every hit they survive', () => {
    const s = game(1); // one zero, 12 HP
    popIn(s);
    const z = s.zeros[0]!;
    expect(damageZero(s, z, 1)).toBe(false);
    expect(z.hp).toBe(11);
    expect(z.hitFlash).toBe(1);
    expect(s.particles.count).toBe(HIT_SPARKS);
    expect(s.report.hits).toBe(1);
  });

  it('go down once their HP runs out, however it is dealt', () => {
    const s = game(2); // 6 HP each
    popIn(s);
    const z = s.zeros[0]!;
    damageZero(s, z, 4);
    expect(damageZero(s, z, 4)).toBe(true);
    expect(z.alive).toBe(false);
    expect(s.valueLeft).toBe(1);
  });
});

describe('armored zeros', () => {
  it('drop the counter by their value', () => {
    const s = game(250); // 22 armored ×10, 30 standard
    popIn(s);
    const armored = s.zeros.filter((z) => z.kind === 'armored');
    for (const z of armored.slice(0, 3)) damageZero(s, z, 100);
    expect(s.valueLeft).toBe(250 - 3 * 10);
    expect(s.report.armoredKills).toBe(3);
  });

  it('take several hits, keeping their energy bar', () => {
    const s = game(250);
    popIn(s);
    const z = s.zeros.find((x) => x.kind === 'armored')!;
    expect(z.energyBar).toBe(true);
    for (let i = 1; i < z.maxHp; i++) expect(damageZero(s, z, 1)).toBe(false);
    expect(damageZero(s, z, 1)).toBe(true);
  });

  it('go up bigger than standard zeros', () => {
    const s = game(250);
    const armored = s.zeros.find((z) => z.kind === 'armored')!;
    killZero(s, armored);
    expect(s.particles.count).toBe((KILL_SPARKS_BUSY + KILL_FRAGMENTS_BUSY) * ARMOR_BURST_SCALE);
    const ring = s.rings.items[0]!;
    const standard = game(250);
    killZero(standard, standard.zeros.find((z) => z.kind === 'standard')!);
    expect(ring.max / armored.ry).toBeCloseTo((standard.rings.items[0]!.max / standard.zeros[0]!.ry) * ARMOR_BURST_SCALE);
  });

  it.each([
    [61, [10]],
    [250, [10]],
    [997, [25, 26]],
    [100_000, [1666, 1667]],
  ])('n = %i: each armored zero wears the badge for its value', (n, values) => {
    const groups = composeRound(n).groups;
    expect(armorBadges(groups)).toEqual(values);
    const s = game(n);
    for (const z of s.zeros) {
      if (z.kind === 'armored') expect(values[z.badge]).toBe(z.value);
      else expect(z.badge).toBe(-1);
    }
  });

  it('wear no badges in a round without armor', () => {
    expect(armorBadges(composeRound(60).groups)).toEqual([]);
    expect(game(7).zeros.every((z) => z.badge === -1)).toBe(true);
  });
});
