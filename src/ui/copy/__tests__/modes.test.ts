// The round's words per game mode: the Shooter's stay exactly as they shipped, and each mode's
// are short, plain and kind, and read well with its power-ups' names.
import { describe, expect, it } from '@jest/globals';

import { modeById, WEAPONS, type ModeId } from '@/engine';

import { MODE_COPY, powerUp } from '../modes';

/** Modes whose lines are final: the Shooter, and each mode as its round lands. */
const FINAL: readonly ModeId[] = ['shooter', 'catch', 'orbit', 'slice', 'breaker'];
/** The hint shows over the board on one line, even on a small phone. */
const MAX_HINT = 40;

describe('MODE_COPY', () => {
  it('keeps the Shooter’s words exactly as they shipped', () => {
    expect(MODE_COPY.shooter).toEqual({
      hint: 'Hold anywhere to fire',
      tier: 'Weapon',
      switchHint: 'Switches to your next weapon',
    });
  });

  it.each(FINAL)('%s: a short, plain hint, and a switch that says what it does', (mode) => {
    const copy = MODE_COPY[mode];
    expect(copy.hint.length).toBeLessThanOrEqual(MAX_HINT);
    expect(copy.hint).not.toMatch(/[!?]/);
    expect(copy.switchHint).toMatch(/^Switches to your next /);
  });

  it.each(FINAL)('%s: the switch reads well with every power-up ("Catcher: Net", never "Blade: Blade")', (mode) => {
    const tier = MODE_COPY[mode].tier.toLowerCase();
    for (const name of modeById(mode).tiers) expect(name.toLowerCase()).not.toBe(tier);
  });
});

describe('powerUp', () => {
  it('is the weapon itself in the Shooter, and in Orbit', () => {
    for (const mode of ['shooter', 'orbit'] as const) {
      for (const w of WEAPONS) expect(powerUp(mode, w)).toEqual({ name: w.name, description: w.description, kind: 'weapon' });
    }
  });

  it("goes by the mode's own name elsewhere, without a weapon's description", () => {
    const twin = WEAPONS[1]!;
    expect(powerUp('catch', twin)).toEqual({ name: 'Twin Cups', description: null, kind: 'catcher' });
    expect(powerUp('slice', twin)).toEqual({ name: 'Twin Blade', description: null, kind: 'power-up' });
    expect(powerUp('breaker', twin)).toEqual({ name: '2 balls', description: null, kind: 'power-up' });
  });
});
