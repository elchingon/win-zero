'worklet';
// Armored zeros wear a ×V badge. The atlas bakes one badge per distinct V, in this order, and
// each armored zero keeps the index of its own. In Orbit, the pieces an armored zero splits into
// wear badges too, baked after the round's own. Called on both threads (the bake runs on JS).
import type { ZeroGroup } from '@/engine';

import { ORBIT_PIECES } from './constants';

/** The distinct armored values in the round, in group order. */
export function armorBadges(groups: readonly ZeroGroup[]): number[] {
  const values: number[] = [];
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (group && group.kind === 'armored' && values.indexOf(group.value) < 0) values.push(group.value);
  }
  return values;
}

/** What piece `k` of a zero worth `value` carries when it splits: equal shares, the last taking what's left. */
export function pieceValue(value: number, k: number): number {
  const share = Math.floor(value / ORBIT_PIECES);
  return k < ORBIT_PIECES - 1 ? share : value - share * (ORBIT_PIECES - 1);
}

/** Orbit: the distinct values armored zeros' pieces carry, in group order. */
export function pieceBadges(groups: readonly ZeroGroup[]): number[] {
  const values: number[] = [];
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (!group || group.kind !== 'armored') continue;
    for (let k = 0; k < ORBIT_PIECES; k++) {
      const v = pieceValue(group.value, k);
      if (values.indexOf(v) < 0) values.push(v);
    }
  }
  return values;
}
