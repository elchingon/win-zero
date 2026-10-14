'worklet';
// Armored zeros wear a ×V badge. The atlas bakes one badge per distinct V, in this order, and
// each armored zero keeps the index of its own. Called on both threads (the bake runs on JS).
import type { ZeroGroup } from '@/engine';

/** The distinct armored values in the round, in group order. */
export function armorBadges(groups: readonly ZeroGroup[]): number[] {
  const values: number[] = [];
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (group && group.kind === 'armored' && values.indexOf(group.value) < 0) values.push(group.value);
  }
  return values;
}
