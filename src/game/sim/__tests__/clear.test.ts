// Every round can be cleared (SPEC 9: no mode can be lost). The bot plays each mode's weakest and
// strongest power-up on a phone and a tablet, across the round sizes that change how a round is
// built (energy zeros, standard, armored, the object cap), and every frame the counter, ×V, the
// board's edges, the effect caps and the phases must hold. Game modes join as their rounds land.
import { describe, expect, it } from '@jest/globals';

import { modeTier, WEAPONS, type ModeId, type WeaponDef } from '@/engine';

import { clearRound, LIMIT_FRAMES, roundConfig, SCREENS } from './bot';

const MODES: readonly ModeId[] = ['shooter'];
const SIZES = [1, 7, 8, 60, 61, 250, 1000] as const;
const TIERS = [WEAPONS[0], WEAPONS[WEAPONS.length - 1]] as WeaponDef[];

const cases = MODES.flatMap((mode) =>
  SCREENS.flatMap((screen) =>
    TIERS.flatMap((weapon) => SIZES.map((n) => ({ mode, screen, weapon, n, tier: modeTier(mode, weapon.id) }))),
  ),
);

describe('every round clears', () => {
  it.each(cases)('$mode on a $screen.name with the $tier: Day $n', ({ mode, screen, weapon, n }) => {
    const { state, frames, finals, results, violations } = clearRound(
      roundConfig(n, { mode, weapon, screen, seed: 7000 + n }),
    );
    expect({
      violations,
      phase: state.phase,
      finals,
      results,
      valueLeft: state.valueLeft,
      time: frames < LIMIT_FRAMES ? 'in time' : `gave up after ${frames} frames`,
    }).toEqual({ violations: [], phase: 'done', finals: 1, results: 1, valueLeft: 0, time: 'in time' });
  });
});
