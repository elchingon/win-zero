// Each game mode draws what the player plays with (Catch's cups, …) while the round is played and
// celebrated, through only the calls the website's stand-in canvas has, and nothing of it over the
// fill. The canvas here records each call by name and throws on any other.
import { describe, expect, it } from '@jest/globals';
import type { ModeId, WeaponId } from '@/engine';

import { pointerDown, pointerMove } from '../../sim/input';
import { step } from '../../sim/step';
import type { GameState } from '../../sim/types';
import { modeGame, popIn } from '../../sim/__tests__/fixtures';
import { draw } from './stub';

/** The same frame, drawn as if the round were the Shooter's. */
function drawnAsShooter(s: GameState): string[] {
  const mode = s.mode;
  s.mode = 'shooter';
  const calls = draw(s);
  s.mode = mode;
  return calls;
}

const MODES: readonly { mode: ModeId; tiers: WeaponId[] }[] = [
  { mode: 'catch', tiers: ['pea', 'twin', 'rocket', 'laser', 'nuke'] },
  { mode: 'orbit', tiers: ['pea', 'laser', 'nuke'] },
  { mode: 'slice', tiers: ['pea', 'twin', 'laser'] },
  { mode: 'breaker', tiers: ['pea', 'scatter', 'rocket', 'chain', 'laser', 'nuke'] },
];

/** A finger on the board, sliding: every mode has something to show for it. */
function play(s: GameState): void {
  pointerDown(s, s.width / 3, s.height / 2);
  for (let f = 0; f < 30; f++) {
    pointerMove(s, s.width / 3 + f * 6, s.height / 2 - f * 2);
    step(s, 1 / 60);
  }
}

describe.each(MODES)('$mode', ({ mode, tiers }) => {
  it.each(tiers)('draws its own pieces in play with the %s tier, not the turret', (tier) => {
    const s = modeGame(mode, 60, { weapon: tier });
    popIn(s);
    play(s);
    const calls = draw(s);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls).not.toEqual(drawnAsShooter(s));
  });

  it('draws its pieces through the celebration, and nothing of them over the fill', () => {
    const s = modeGame(mode, 7);
    popIn(s);
    play(s);
    s.zeros.forEach((z) => (z.alive = false));
    s.phase = 'celebrate';
    expect(draw(s)).not.toEqual(drawnAsShooter(s));
    for (const phase of ['fill', 'done'] as const) {
      s.phase = phase;
      expect(draw(s)).toEqual(drawnAsShooter(s));
    }
  });
});
