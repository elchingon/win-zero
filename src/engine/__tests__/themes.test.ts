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
  THEMES,
  type ThemeId,
} from '../themes';

const FREE = { themesEnabled: false };
const PLUS = { themesEnabled: true };
const ids = (themes: readonly { id: ThemeId }[]) => themes.map((t) => t.id);

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
    for (const best of [0, 30, 365, 10_000]) expect(ids(availableThemes(best, FREE))).toEqual(['classic']);
  });

  it('offers Plus Classic and the included themes from the start', () => {
    expect(ids(availableThemes(0, PLUS))).toEqual(['classic', 'neon', 'mono', 'pastel']);
    expect(ids(availableThemes(THEME_UNLOCK_EMBER - 1, PLUS))).toEqual(['classic', 'neon', 'mono', 'pastel']);
  });

  it('opens each earned theme at its best streak', () => {
    expect(ids(availableThemes(THEME_UNLOCK_EMBER, PLUS)).at(-1)).toBe('ember');
    expect(ids(availableThemes(THEME_UNLOCK_AURORA - 1, PLUS)).at(-1)).toBe('ember');
    expect(ids(availableThemes(THEME_UNLOCK_AURORA, PLUS)).at(-1)).toBe('aurora');
    expect(ids(availableThemes(THEME_UNLOCK_GOLD - 1, PLUS)).at(-1)).toBe('aurora');
    expect(ids(availableThemes(THEME_UNLOCK_GOLD, PLUS))).toEqual(THEME_IDS);
  });

  it('only ever grows as the best streak does', () => {
    let before = ids(availableThemes(0, PLUS));
    for (let best = 1; best <= 400; best++) {
      const now = ids(availableThemes(best, PLUS));
      expect(now.slice(0, before.length)).toEqual(before);
      before = now;
    }
    expect(before).toEqual(THEME_IDS);
  });
});

describe('the equipped theme', () => {
  it('is the pick while it is available', () => {
    expect(equippedTheme('neon', 0, PLUS)).toBe('neon');
    expect(equippedTheme('ember', THEME_UNLOCK_EMBER, PLUS)).toBe('ember');
    expect(equippedTheme('classic', 0, FREE)).toBe('classic');
  });

  it('falls back to Classic for no pick, a theme not yet earned, Win Zero, or anything else', () => {
    expect(equippedTheme(null, 400, PLUS)).toBe('classic');
    expect(equippedTheme('ember', THEME_UNLOCK_EMBER - 1, PLUS)).toBe('classic');
    expect(equippedTheme('gold', THEME_UNLOCK_GOLD - 1, PLUS)).toBe('classic');
    for (const id of THEME_IDS) expect(equippedTheme(id, 400, FREE)).toBe('classic');
    expect(equippedTheme('sepia' as ThemeId, 400, PLUS)).toBe('classic');
  });
});

describe('newly unlocked themes', () => {
  it('names the earned themes a rise in the best streak opens', () => {
    expect(ids(newlyUnlockedThemes(29, 30, PLUS))).toEqual(['ember']);
    expect(ids(newlyUnlockedThemes(179, 180, PLUS))).toEqual(['aurora']);
    expect(ids(newlyUnlockedThemes(0, 365, PLUS))).toEqual(['ember', 'aurora', 'gold']);
  });

  it('announces nothing without a rise past an unlock, for included themes, or in Win Zero', () => {
    expect(newlyUnlockedThemes(30, 30, PLUS)).toEqual([]);
    expect(newlyUnlockedThemes(30, 31, PLUS)).toEqual([]);
    expect(newlyUnlockedThemes(400, 30, PLUS)).toEqual([]);
    expect(newlyUnlockedThemes(0, 1, PLUS)).toEqual([]);
    expect(newlyUnlockedThemes(0, 365, FREE)).toEqual([]);
  });
});
