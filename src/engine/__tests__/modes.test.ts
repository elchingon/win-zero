import { describe, expect, it } from '@jest/globals';

import {
  availableModes,
  DEFAULT_MODE,
  equippedMode,
  isModeId,
  MODE_IDS,
  MODE_UNLOCK_AT,
  modeById,
  MODES,
  modeTier,
  PLAYABLE_MODES,
  type ModeId,
} from '../modes';
import { WEAPONS, weaponById } from '../weapons';

const FREE = { modesEnabled: false };
const PLUS = { modesEnabled: true };

describe('game modes (SPEC 9)', () => {
  it('matches the SPEC table: five modes, seven power-ups each', () => {
    const weapons = WEAPONS.map((w) => w.name);
    expect(MODES.map((m) => [m.id, m.name, [...m.tiers]])).toEqual([
      ['shooter', 'Shooter', weapons],
      ['catch', 'Catch', ['Cup', 'Twin Cups', 'Net', 'Magnet', 'Chain Catch', 'Vacuum Beam', 'Black Hole']],
      ['orbit', 'Orbit', weapons],
      ['slice', 'Slice', ['Blade', 'Twin Blade', 'Wide Arc', 'Explosive Cut', 'Arcing Cut', 'Lingering Blade', 'Nova']],
      ['breaker', 'Breaker', ['1 ball', '2 balls', 'Multi-ball', 'Fireball', 'Lightning Ball', 'Laser Paddle', 'Mega Ball']],
    ]);
    expect(MODE_IDS).toEqual(MODES.map((m) => m.id));
  });

  it('gives every mode one distinct power-up per weapon tier', () => {
    for (const m of MODES) {
      expect(m.tiers).toHaveLength(WEAPONS.length);
      expect(new Set(m.tiers).size).toBe(WEAPONS.length);
    }
  });

  it('opens every mode from the start', () => {
    expect(MODE_UNLOCK_AT).toBe(1);
    for (const m of MODES) expect(m.unlockAt).toBe(MODE_UNLOCK_AT);
  });

  it('names a tier by the weapon at the same place', () => {
    for (const w of WEAPONS) expect(modeTier('shooter', w.id)).toBe(weaponById(w.id).name);
    expect(modeTier('catch', 'scatter')).toBe('Net');
    expect(modeTier('slice', 'pea')).toBe('Blade');
    expect(modeTier('breaker', 'nuke')).toBe('Mega Ball');
    expect(modeTier('orbit', 'laser')).toBe('Rail Laser');
  });

  it('knows its ids', () => {
    for (const id of MODE_IDS) expect(isModeId(id)).toBe(true);
    for (const bad of ['', 'Shooter', 'pong', null, undefined, 3, {}]) expect(isModeId(bad)).toBe(false);
    expect(modeById('slice').name).toBe('Slice');
    expect(() => modeById('pong' as ModeId)).toThrow(RangeError);
  });

  it('only plays modes from the list, and always the Shooter', () => {
    expect(PLAYABLE_MODES).toContain(DEFAULT_MODE);
    for (const id of PLAYABLE_MODES) expect(MODE_IDS).toContain(id);
  });
});

describe('available modes', () => {
  it('is only the Shooter in Win Zero, at any streak', () => {
    for (const best of [0, 1, 30, 365, 1000]) expect(availableModes(best, FREE).map((m) => m.id)).toEqual(['shooter']);
  });

  it('offers Plus every mode whose round is built, from the start', () => {
    for (const best of [0, 1, 100]) expect(availableModes(best, PLUS).map((m) => m.id)).toEqual([...PLAYABLE_MODES]);
  });

  it('offers every mode whose round is built, and nothing else', () => {
    // Each mode joins as its round lands (M7).
    expect(availableModes(100, PLUS).map((m) => m.id)).toEqual(['shooter', 'catch', 'orbit', 'slice']);
  });
});

describe('the equipped mode', () => {
  it('is the pick while it is available', () => {
    expect(equippedMode('shooter', 1, PLUS)).toBe('shooter');
    expect(equippedMode('shooter', 1, FREE)).toBe('shooter');
    expect(equippedMode('catch', 1, PLUS)).toBe('catch');
    expect(equippedMode('orbit', 1, PLUS)).toBe('orbit');
    expect(equippedMode('slice', 1, PLUS)).toBe('slice');
  });

  it('falls back to the Shooter for no pick, a mode not offered, or anything else', () => {
    expect(equippedMode(null, 50, PLUS)).toBe('shooter');
    for (const id of MODE_IDS) expect(equippedMode(id, 50, FREE)).toBe('shooter');
    expect(equippedMode('breaker', 50, PLUS)).toBe('shooter'); // no round yet
    expect(equippedMode('pong' as ModeId, 50, PLUS)).toBe('shooter');
  });
});
