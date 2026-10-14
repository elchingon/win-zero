// Round composition (SPEC 4). The counter in the HUD shows zero *value* remaining, which can
// exceed the number of objects once armored zeros appear.

/** Days 1–7 get a few tough zeros with energy bars. */
export const ENERGY_MAX_N = 7;
/** Total HP shared across an energy round before the per-zero minimum kicks in. */
export const ENERGY_HP_POOL = 12;
export const ENERGY_HP_MIN = 3;

/** Most objects on screen at once. Above this, armored zeros carry several zeros each. */
export const OBJECT_CAP = 60;
/** Armored zero values, smallest first. The smallest that fits is used. */
export const ARMOR_VALUES = [10, 25, 50, 100] as const;
export const ARMOR_HP_BASE = 5;
/** Armored HP rises by 1 per this many zeros in the round. */
export const ARMOR_HP_STEP = 100;
export const ARMOR_HP_CAP = 12;

/** Most glyphs drawn in the celebration fill. Above this, the full number is overlaid. */
export const FILL_GLYPH_CAP = 500;

export type ZeroKind = 'energy' | 'standard' | 'armored';

export interface ZeroGroup {
  kind: ZeroKind;
  count: number;
  hp: number;
  /** Zeros each object counts for. */
  value: number;
  energyBar: boolean;
}

export interface Round {
  /** Total zero value: the day's streak. */
  n: number;
  objectCount: number;
  groups: ZeroGroup[];
}

export function armoredHp(n: number): number {
  return Math.min(ARMOR_HP_CAP, ARMOR_HP_BASE + Math.floor(n / ARMOR_HP_STEP));
}

function round(n: number, groups: ZeroGroup[]): Round {
  const nonEmpty = groups.filter((g) => g.count > 0);
  return { n, objectCount: nonEmpty.reduce((sum, g) => sum + g.count, 0), groups: nonEmpty };
}

export function composeRound(n: number): Round {
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`Round size must be a positive integer, got ${n}`);

  if (n <= ENERGY_MAX_N) {
    const hp = Math.max(ENERGY_HP_MIN, Math.ceil(ENERGY_HP_POOL / n));
    return round(n, [{ kind: 'energy', count: n, hp, value: 1, energyBar: true }]);
  }
  if (n <= OBJECT_CAP) {
    return round(n, [{ kind: 'standard', count: n, hp: 1, value: 1, energyBar: false }]);
  }

  const hp = armoredHp(n);
  const standard = (count: number): ZeroGroup => ({ kind: 'standard', count, hp: 1, value: 1, energyBar: false });
  const armored = (count: number, value: number): ZeroGroup => ({ kind: 'armored', count, hp, value, energyBar: true });

  // SPEC rule: the smallest V with an exact fit, using the fewest armored zeros so the most
  // regular zeros remain.
  for (const value of ARMOR_VALUES) {
    const count = Math.ceil((n - OBJECT_CAP) / (value - 1));
    const regular = n - value * count;
    if (regular >= 0) return round(n, [standard(regular), armored(count, value)]);
  }

  // Some n have no exact fit for any V (the first is 997: 39 × 25 + 22 is 61 objects). Fill
  // the cap using the smallest V that works, with one heavier armored zero (V < value < 2V)
  // carrying the remainder.
  for (const value of ARMOR_VALUES) {
    const first = Math.max(1, Math.ceil((n - OBJECT_CAP + 1 - value) / (value - 1)));
    for (let count = first; count <= OBJECT_CAP; count++) {
      const regular = OBJECT_CAP - count;
      const heavy = n - value * (count - 1) - regular;
      if (heavy <= value) break;
      if (heavy < 2 * value) return round(n, [standard(regular), armored(count - 1, value), armored(1, heavy)]);
    }
  }

  // Past OBJECT_CAP × the largest value (a 16-year streak): split n across a full cap of armored zeros.
  const base = Math.floor(n / OBJECT_CAP);
  const heavier = n - base * OBJECT_CAP;
  return round(n, [armored(OBJECT_CAP - heavier, base), armored(heavier, base + 1)]);
}

export interface FillPlan {
  /** Zero glyphs to draw. */
  glyphs: number;
  /** Draw the full number large on top, because not every zero fits. */
  overlayNumber: boolean;
}

export function fillPlan(n: number): FillPlan {
  return { glyphs: Math.min(n, FILL_GLYPH_CAP), overlayNumber: n > FILL_GLYPH_CAP };
}
