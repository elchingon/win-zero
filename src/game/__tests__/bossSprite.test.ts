// The boss's sprite (SPEC 4) is baked once, at the biggest a boss gets on the screen in any game, so
// it's never drawn bigger than it was baked, and within its own pixel limit, so the sheet stays small.
import { describe, expect, it } from '@jest/globals';

import { BOSS_DAYS, bossGroups, bossPlan, fillPlan, MODE_IDS, weaponById } from '@/engine';

import { BOSS_SPRITE_MAX_RY_PX, bossRingDensity, bossSpriteRadius, SPRITE_MAX_DENSITY } from '../look';
import { buildGame } from '../sim/spawn';

const SCREENS = [
  { width: 360, height: 780, insetTop: 24, insetBottom: 48 },
  { width: 390, height: 844, insetTop: 47, insetBottom: 34 },
  { width: 1024, height: 1366, insetTop: 24, insetBottom: 20 },
  { width: 1920, height: 1080, insetTop: 0, insetBottom: 0 },
];

describe("the boss's sprite", () => {
  it.each(SCREENS)('is at least as big as any boss on a $width × $height screen', (screen) => {
    const sprite = bossSpriteRadius(screen.width, screen.height);
    for (const mode of MODE_IDS) {
      for (const day of BOSS_DAYS) {
        const boss = bossPlan(day, mode);
        const s = buildGame(
          { n: day, groups: bossGroups(boss), fill: fillPlan(day), ...screen, weapon: weaponById('pea'), seed: 1, reduceMotion: false, mode, boss },
          mode,
        );
        expect(s.zeros[0]?.ry).toBeLessThanOrEqual(sprite + 1e-9);
      }
    }
  });

  it.each([1, 2, 3, 4])('stays within its pixel limit at a pixel ratio of %i', (pixelRatio) => {
    for (const screen of SCREENS) {
      const ry = bossSpriteRadius(screen.width, screen.height);
      const density = bossRingDensity(pixelRatio, ry);
      expect(density).toBeGreaterThanOrEqual(1);
      expect(density).toBeLessThanOrEqual(Math.min(pixelRatio, SPRITE_MAX_DENSITY));
      expect(ry * density).toBeLessThanOrEqual(Math.max(ry, BOSS_SPRITE_MAX_RY_PX) + 1e-9);
    }
  });
});
