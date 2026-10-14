// SPEC 4: composeRound(n) and the celebration fill.
import { describe, expect, it } from '@jest/globals';

import {
  ARMOR_VALUES,
  armoredHp,
  composeRound,
  fillPlan,
  OBJECT_CAP,
  type Round,
  type ZeroGroup,
} from '../round';

const group = (r: Round, kind: ZeroGroup['kind']) => r.groups.filter((g) => g.kind === kind);
const totalValue = (r: Round) => r.groups.reduce((sum, g) => sum + g.count * g.value, 0);

describe('composeRound', () => {
  it.each([
    [1, 12],
    [2, 6],
    [3, 4],
    [4, 3],
    [5, 3],
    [6, 3],
    [7, 3],
  ])('n = %i: energy-bar zeros with %i HP each', (n, hp) => {
    expect(composeRound(n)).toEqual({
      n,
      objectCount: n,
      groups: [{ kind: 'energy', count: n, hp, value: 1, energyBar: true }],
    });
  });

  it('n = 8: standard one-hit zeros, no energy bar', () => {
    expect(composeRound(8)).toEqual({
      n: 8,
      objectCount: 8,
      groups: [{ kind: 'standard', count: 8, hp: 1, value: 1, energyBar: false }],
    });
  });

  it('n = 60: still all standard, at the object cap', () => {
    expect(composeRound(60)).toEqual({
      n: 60,
      objectCount: 60,
      groups: [{ kind: 'standard', count: 60, hp: 1, value: 1, energyBar: false }],
    });
  });

  it('n = 61: 1 armored ×10 + 51 regular (SPEC example)', () => {
    expect(composeRound(61)).toEqual({
      n: 61,
      objectCount: 52,
      groups: [
        { kind: 'standard', count: 51, hp: 1, value: 1, energyBar: false },
        { kind: 'armored', count: 1, hp: 5, value: 10, energyBar: true },
      ],
    });
  });

  it('n = 250: 22 armored ×10 + 30 regular (SPEC example)', () => {
    expect(composeRound(250)).toEqual({
      n: 250,
      objectCount: 52,
      groups: [
        { kind: 'standard', count: 30, hp: 1, value: 1, energyBar: false },
        { kind: 'armored', count: 22, hp: 7, value: 10, energyBar: true },
      ],
    });
  });

  it('n = 1000: ×10 no longer fits, so 40 armored ×25 with capped HP', () => {
    expect(composeRound(1000)).toEqual({
      n: 1000,
      objectCount: 40,
      groups: [{ kind: 'armored', count: 40, hp: 12, value: 25, energyBar: true }],
    });
  });

  it('n = 592 uses ×25 badges, but n = 600 fits 60 × ×10 exactly (smallest V wins)', () => {
    const r592 = composeRound(592);
    expect(group(r592, 'armored')).toEqual([{ kind: 'armored', count: 23, hp: 10, value: 25, energyBar: true }]);
    expect(group(r592, 'standard')).toEqual([{ kind: 'standard', count: 17, hp: 1, value: 1, energyBar: false }]);
    expect(composeRound(600).groups).toEqual([{ kind: 'armored', count: 60, hp: 11, value: 10, energyBar: true }]);
  });

  it('armored HP is 5 + floor(n / 100), capped at 12', () => {
    expect([61, 199, 200, 250, 699, 700, 1000, 5000].map(armoredHp)).toEqual([5, 6, 7, 7, 11, 12, 12, 12]);
  });

  it('holds the SPEC 4 rules for every n from 1 to 6000', () => {
    // Brute force: can value V make n exactly with `a` armored zeros plus regular ones, within the cap?
    const fits = (n: number, v: number, a: number) => n - v * a >= 0 && n - v * a + a <= OBJECT_CAP;
    const exactFor = (n: number, v: number) => {
      for (let a = 0; a <= OBJECT_CAP; a++) if (fits(n, v, a)) return true;
      return false;
    };
    const failures: string[] = [];
    let gaps = 0;
    for (let n = 1; n <= 6000; n++) {
      const r = composeRound(n);
      const fail = (why: string) => failures.push(`${n}: ${why}`);
      if (totalValue(r) !== n) fail('values do not add up to n');
      if (r.objectCount > OBJECT_CAP) fail('over the object cap');
      if (r.objectCount !== r.groups.reduce((s, g) => s + g.count, 0)) fail('objectCount mismatch');
      if (n <= OBJECT_CAP) continue;

      const armored = group(r, 'armored');
      const { value, count } = armored[0] as ZeroGroup;
      if (armored.length === 1) {
        // SPEC rule: smallest V with an exact fit, and the fewest armored zeros for it.
        if (ARMOR_VALUES.some((v) => v < value && exactFor(n, v))) fail('a smaller V fits');
        if (!fits(n, value, count)) fail('not an exact fit');
        if (count > 0 && fits(n, value, count - 1)) fail('not the fewest armored zeros');
      } else {
        // No exact fit for any V: one heavier zero carries the remainder and the cap is full.
        gaps++;
        const heavy = armored[1];
        if (ARMOR_VALUES.some((v) => exactFor(n, v))) fail('an exact fit exists');
        if (armored.length !== 2 || heavy?.count !== 1) fail('expected exactly one heavier zero');
        if (!heavy || heavy.value <= value || heavy.value >= 2 * value) fail('heavier zero out of range');
        if (r.objectCount !== OBJECT_CAP) fail('cap not filled');
      }
    }
    expect(failures).toEqual([]);
    expect(gaps).toBe(3255);
  });

  it('n = 997, the first with no exact fit: 38 ×25 + one ×26 + 21 regular', () => {
    expect(composeRound(997).groups).toEqual([
      { kind: 'standard', count: 21, hp: 1, value: 1, energyBar: false },
      { kind: 'armored', count: 38, hp: 12, value: 25, energyBar: true },
      { kind: 'armored', count: 1, hp: 12, value: 26, energyBar: true },
    ]);
    expect(composeRound(1849).groups.map((g) => [g.count, g.value])).toEqual([
      [24, 1],
      [35, 50],
      [1, 75],
    ]);
  });

  it('past 6000, splits n across 60 armored zeros', () => {
    const r = composeRound(6001);
    expect(r.objectCount).toBe(OBJECT_CAP);
    expect(totalValue(r)).toBe(6001);
    expect(r.groups).toEqual([
      { kind: 'armored', count: 59, hp: 12, value: 100, energyBar: true },
      { kind: 'armored', count: 1, hp: 12, value: 101, energyBar: true },
    ]);
    expect(totalValue(composeRound(12345))).toBe(12345);
  });

  it('rejects sizes that are not positive integers', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => composeRound(bad)).toThrow(RangeError);
    }
  });
});

describe('fillPlan', () => {
  it('draws up to 500 zeros and overlays the number above that', () => {
    expect(fillPlan(1)).toEqual({ glyphs: 1, overlayNumber: false });
    expect(fillPlan(500)).toEqual({ glyphs: 500, overlayNumber: false });
    expect(fillPlan(501)).toEqual({ glyphs: 500, overlayNumber: true });
    expect(fillPlan(1000)).toEqual({ glyphs: 500, overlayNumber: true });
  });
});
