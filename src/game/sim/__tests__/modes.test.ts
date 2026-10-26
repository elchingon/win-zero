// The round's mode: which one it plays, the pointer the canvas reports, and the shared fields
// modes lean on. Until other modes' rounds are built, everything plays the Shooter.
import { describe, expect, it } from '@jest/globals';

import { PLAYABLE_MODES, type ModeId } from '@/engine';

import { damageZero } from '../damage';
import { moveAim, pointerDown, pointerMove, pointerUp, pressFire, releaseFire } from '../input';
import { step } from '../step';
import { game, popIn, run } from './fixtures';

describe('the round’s mode', () => {
  it('is the Shooter unless asked for another', () => {
    for (const s of [game(7), game(7, { mode: 'shooter' })]) {
      expect(s.mode).toBe('shooter');
      expect(s.modeState).toEqual({ mode: 'shooter' });
    }
  });

  it('plays the Shooter for a mode whose round isn’t built yet, or one it doesn’t know', () => {
    for (const mode of ['catch', 'orbit', 'slice', 'breaker', 'pong'] as ModeId[]) {
      if (PLAYABLE_MODES.includes(mode)) continue;
      const s = game(7, { mode });
      expect(s.mode).toBe('shooter');
      expect(s.modeState).toEqual({ mode: 'shooter' });
    }
  });

  it.each(PLAYABLE_MODES)('plays %s when asked', (mode) => {
    const s = game(60, { mode });
    expect(s.mode).toBe(mode);
    expect(s.modeState.mode).toBe(mode);
  });

  it('starts every zero ready to be caught or cut', () => {
    expect(game(250).zeros.every((z) => z.cooldown === 0)).toBe(true);
  });
});

describe('the pointer', () => {
  it('lands, moves and lifts, keeping where the finger is', () => {
    const s = game(60);
    expect(s.pointer).toEqual({ down: false, x: 0, y: 0 });
    pointerDown(s, 100, 300);
    expect(s.pointer).toEqual({ down: true, x: 100, y: 300 });
    pointerMove(s, 120, 280);
    expect(s.pointer).toEqual({ down: true, x: 120, y: 280 });
    pointerUp(s);
    expect(s.pointer).toEqual({ down: false, x: 120, y: 280 });
  });

  it('fires and aims the Shooter just as the press calls do', () => {
    const viaPointer = game(60, { seed: 9 });
    const viaPress = game(60, { seed: 9 });
    pointerDown(viaPointer, 100, 300);
    pressFire(viaPress, 100, 300);
    for (let f = 0; f < 30; f++) {
      pointerMove(viaPointer, 100 + f * 5, 300 - f * 3);
      moveAim(viaPress, 100 + f * 5, 300 - f * 3);
      step(viaPointer, 1 / 60);
      step(viaPress, 1 / 60);
    }
    pointerUp(viaPointer);
    releaseFire(viaPress);
    step(viaPointer, 1 / 60);
    step(viaPress, 1 / 60);
    const { pointer, ...rest } = viaPointer;
    const { pointer: untouched, ...restPress } = viaPress;
    expect(pointer.down).toBe(false);
    expect(untouched).toEqual({ down: false, x: 0, y: 0 });
    expect(rest).toEqual(restPress);
    expect(viaPointer.firing).toBe(false);
    expect(viaPointer.report.shots).toBeGreaterThan(0);
  });
});

describe('time since damage', () => {
  it('grows each frame and starts over when a zero takes a hit', () => {
    const s = game(7);
    popIn(s);
    run(s, 0.5);
    expect(s.sinceDamage).toBeCloseTo(0.5);
    const z = s.zeros[0]!;
    expect(damageZero(s, z, 1)).toBe(false);
    expect(s.sinceDamage).toBe(0);
  });

  it('keeps counting through a hit that lands on nothing', () => {
    const s = game(7);
    s.sinceDamage = 2;
    const z = s.zeros[0]!;
    z.age = 0;
    z.delay = 1; // not popped in yet
    expect(damageZero(s, z, 1)).toBe(false);
    expect(s.sinceDamage).toBe(2);
  });
});
