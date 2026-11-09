import { describe, expect, it } from '@jest/globals';

import {
  availableThemes,
  DEFAULT_THEME,
  equippedTheme,
  isThemeId,
  newlyUnlockedThemes,
  THEME_FROM_START,
  THEME_IDS,
  THEME_UNLOCK_AURORA,
  THEME_UNLOCK_EMBER,
  THEME_UNLOCK_GOLD,
  themeById,
  themeOpen,
  THEMES,
  type ThemeDef,
  type ThemeId,
  type ThemeReach,
} from '../themes';

const FREE = { themesEnabled: false };
const PLUS = { themesEnabled: true };
const ids = (themes: readonly { id: ThemeId }[]) => themes.map((t) => t.id);
const reach = (best: number, cameBack = false): ThemeReach => ({ best, cameBack });

describe('themes (SPEC 9)', () => {
  it('matches the SPEC: Classic, three included, three earned by best streak', () => {
    expect(THEMES.map((t) => [t.id, t.name, t.source, t.unlockAt])).toEqual([
      ['classic', 'Classic', 'free', 0],
      ['neon', 'Neon Arcade', 'included', 0],
      ['mono', 'Mono CRT', 'included', 0],
      ['pastel', 'Pastel', 'included', 0],
      ['ember', 'Ember', 'earned', 30],
      ['aurora', 'Aurora', 'earned', 180],
      ['gold', 'Gold Year', 'earned', 365],
    ]);
    expect([THEME_FROM_START, THEME_UNLOCK_EMBER, THEME_UNLOCK_AURORA, THEME_UNLOCK_GOLD]).toEqual([0, 30, 180, 365]);
    expect(THEME_IDS).toEqual(THEMES.map((t) => t.id));
    expect(DEFAULT_THEME).toBe('classic');
  });

  it('knows its ids', () => {
    for (const id of THEME_IDS) expect(isThemeId(id)).toBe(true);
    for (const bad of ['', 'Classic', 'neon arcade', 'sepia', null, undefined, 3, {}]) expect(isThemeId(bad)).toBe(false);
    expect(themeById('gold').name).toBe('Gold Year');
    expect(() => themeById('sepia' as ThemeId)).toThrow(RangeError);
  });
});

describe('available themes', () => {
  it('is only Classic in Win Zero, at any streak', () => {
    for (const best of [0, 30, 365, 10_000]) expect(ids(availableThemes(reach(best), FREE))).toEqual(['classic']);
  });

  it('offers Plus Classic and the included themes from the start', () => {
    expect(ids(availableThemes(reach(0), PLUS))).toEqual(['classic', 'neon', 'mono', 'pastel']);
    expect(ids(availableThemes(reach(THEME_UNLOCK_EMBER - 1), PLUS))).toEqual(['classic', 'neon', 'mono', 'pastel']);
  });

  it('opens each earned theme at its best streak', () => {
    expect(ids(availableThemes(reach(THEME_UNLOCK_EMBER), PLUS)).at(-1)).toBe('ember');
    expect(ids(availableThemes(reach(THEME_UNLOCK_AURORA - 1), PLUS)).at(-1)).toBe('ember');
    expect(ids(availableThemes(reach(THEME_UNLOCK_AURORA), PLUS)).at(-1)).toBe('aurora');
    expect(ids(availableThemes(reach(THEME_UNLOCK_GOLD - 1), PLUS)).at(-1)).toBe('aurora');
    expect(ids(availableThemes(reach(THEME_UNLOCK_GOLD), PLUS))).toEqual(THEME_IDS);
  });

  it('only ever grows as the best streak does', () => {
    let before = ids(availableThemes(reach(0), PLUS));
    for (let best = 1; best <= 400; best++) {
      const now = ids(availableThemes(reach(best), PLUS));
      expect(now.slice(0, before.length)).toEqual(before);
      before = now;
    }
    expect(before).toEqual(THEME_IDS);
  });
});

describe('the equipped theme', () => {
  it('is the pick while it is available', () => {
    expect(equippedTheme('neon', reach(0), PLUS)).toBe('neon');
    expect(equippedTheme('ember', reach(THEME_UNLOCK_EMBER), PLUS)).toBe('ember');
    expect(equippedTheme('classic', reach(0), FREE)).toBe('classic');
  });

  it('falls back to Classic for no pick, a theme not yet earned, Win Zero, or anything else', () => {
    expect(equippedTheme(null, reach(400), PLUS)).toBe('classic');
    expect(equippedTheme('ember', reach(THEME_UNLOCK_EMBER - 1), PLUS)).toBe('classic');
    expect(equippedTheme('gold', reach(THEME_UNLOCK_GOLD - 1), PLUS)).toBe('classic');
    for (const id of THEME_IDS) expect(equippedTheme(id, reach(400), FREE)).toBe('classic');
    expect(equippedTheme('sepia' as ThemeId, reach(400), PLUS)).toBe('classic');
  });
});

describe('newly unlocked themes', () => {
  it('names the earned themes a rise in the best streak opens', () => {
    expect(ids(newlyUnlockedThemes(reach(29), reach(30), PLUS))).toEqual(['ember']);
    expect(ids(newlyUnlockedThemes(reach(179), reach(180), PLUS))).toEqual(['aurora']);
    expect(ids(newlyUnlockedThemes(reach(0), reach(365), PLUS))).toEqual(['ember', 'aurora', 'gold']);
  });

  it('announces nothing without a rise past an unlock, for included themes, or in Win Zero', () => {
    expect(newlyUnlockedThemes(reach(30), reach(30), PLUS)).toEqual([]);
    expect(newlyUnlockedThemes(reach(30), reach(31), PLUS)).toEqual([]);
    expect(newlyUnlockedThemes(reach(400), reach(30), PLUS)).toEqual([]);
    expect(newlyUnlockedThemes(reach(0), reach(1), PLUS)).toEqual([]);
    expect(newlyUnlockedThemes(reach(0), reach(365), FREE)).toEqual([]);
  });
});

describe('a comeback theme', () => {
  const comeback: ThemeDef = { id: 'classic', name: 'Comeback', source: 'comeback', unlockAt: THEME_FROM_START };

  it('opens with a comeback after a reset, at any best streak', () => {
    expect(themeOpen(comeback, reach(10_000))).toBe(false);
    expect(themeOpen(comeback, reach(0, true))).toBe(true);
  });

  it('leaves the other themes to the best streak', () => {
    const ember = themeById('ember');
    expect(themeOpen(ember, reach(THEME_UNLOCK_EMBER - 1, true))).toBe(false);
    expect(themeOpen(ember, reach(THEME_UNLOCK_EMBER))).toBe(true);
  });
});
