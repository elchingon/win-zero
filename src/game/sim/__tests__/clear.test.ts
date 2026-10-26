// Every round can be cleared (SPEC 9: no mode can be lost). The bot plays each mode's weakest and
// strongest power-up on a phone and a tablet, across the round sizes that change how a round is
// built (energy zeros, standard, armored, the object cap), and every frame the counter, ×V, the
// board's edges, the effect caps and the phases must hold. Breaker plays on by itself (its balls
// serve), so it must also clear with nobody touching the screen, on its assists alone; a long
// round from the last few bricks (a full one would, but can take many minutes with one ball).
// Catch has no assist (SPEC 9): its zeros bounce until the player gets a cup under them.
import { describe, expect, it } from '@jest/globals';

import { modeTier, WEAPONS, type ModeId, type WeaponDef } from '@/engine';

import { clearRound, LIMIT_FRAMES, roundConfig, SCREENS, type Cleared, type Hands } from './bot';

const MODES: readonly ModeId[] = ['shooter', 'catch', 'orbit', 'slice', 'breaker'];
/** Modes that must clear hands-off, with the weakest power-up: how, by round size. */
const HANDS_OFF: readonly { mode: ModeId; hands: (n: number) => Hands }[] = [
  { mode: 'breaker', hands: (n) => (n <= 61 ? 'off' : 'tail') },
];
const SIZES = [1, 7, 8, 60, 61, 250, 1000] as const;
const TIERS = [WEAPONS[0], WEAPONS[WEAPONS.length - 1]] as WeaponDef[];

interface Case {
  mode: ModeId;
  screen: (typeof SCREENS)[number];
  weapon: WeaponDef;
  n: number;
  tier: string;
  hands: Hands;
  /** The hands, as the test's name says them. */
  how: string;
}

const played: Case[] = MODES.flatMap((mode) =>
  SCREENS.flatMap((screen) =>
    TIERS.flatMap((weapon) =>
      SIZES.map((n) => ({ mode, screen, weapon, n, tier: modeTier(mode, weapon.id), hands: 'on' as const, how: 'on' })),
    ),
  ),
);

const handsOff: Case[] = HANDS_OFF.flatMap(({ mode, hands }) =>
  SCREENS.flatMap((screen) =>
    SIZES.map((n) => {
      const h = hands(n);
      const how = h === 'tail' ? 'off for the last few bricks' : 'off';
      return { mode, screen, weapon: WEAPONS[0]!, n, tier: modeTier(mode, WEAPONS[0]!.id), hands: h, how };
    }),
  ),
);

function outcome({ state, frames, finals, results, rate, violations }: Cleared) {
  return {
    violations,
    phase: state.phase,
    finals,
    results,
    valueLeft: state.valueLeft,
    time: frames < LIMIT_FRAMES ? 'in time' : `gave up after ${frames} frames, at ${rate.toFixed(1)} hits a second`,
  };
}

const CLEARED = { violations: [], phase: 'done', finals: 1, results: 1, valueLeft: 0, time: 'in time' };

describe('every round clears', () => {
  it.each(played)('$mode on a $screen.name with the $tier: Day $n', ({ mode, screen, weapon, n }) => {
    expect(outcome(clearRound(roundConfig(n, { mode, weapon, screen, seed: 7000 + n })))).toEqual(CLEARED);
  });
});

describe('every round clears with nobody touching it', () => {
  it.each(handsOff)('$mode on a $screen.name with the $tier, hands $how: Day $n', ({ mode, screen, weapon, n, hands }) => {
    expect(outcome(clearRound(roundConfig(n, { mode, weapon, screen, seed: 9000 + n }), hands))).toEqual(CLEARED);
  });
});
