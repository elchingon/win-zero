import { describe, expect, it } from '@jest/globals';

import {
  APP_ICON_IDS,
  APP_ICONS,
  availableIcons,
  DEFAULT_ICON,
  isAppIconId,
  keptIcon,
  type AppIconId,
} from '../icons';
import {
  availableThemes,
  THEME_IDS,
  THEME_UNLOCK_AURORA,
  THEME_UNLOCK_EMBER,
  THEME_UNLOCK_GOLD,
  THEMES,
  type ThemeReach,
} from '../themes';

const FREE = { iconsEnabled: false };
const PLUS = { iconsEnabled: true };
const ids = (icons: readonly { id: AppIconId }[]) => icons.map((i) => i.id);
const reach = (best: number): ThemeReach => ({ best, cameBack: false });

describe('app icons (SPEC 9)', () => {
  it('is the app’s own icon and one per theme, each opening with its theme', () => {
    expect(APP_ICONS[0]).toEqual({ id: 'default', theme: null, unlockAt: 0 });
    expect(APP_ICONS.slice(1)).toEqual(THEMES.map((t) => ({ id: t.id, theme: t.id, unlockAt: t.unlockAt })));
    expect(APP_ICON_IDS).toEqual(['default', ...THEME_IDS]);
    expect(DEFAULT_ICON).toBe('default');
  });

  it('knows its ids', () => {
    for (const id of APP_ICON_IDS) expect(isAppIconId(id)).toBe(true);
    for (const bad of ['', 'Default', 'plus', 'sepia', null, undefined, 0, {}]) expect(isAppIconId(bad)).toBe(false);
  });
});

describe('available icons', () => {
  it('is only the app’s own in Win Zero, at any streak', () => {
    for (const best of [0, 30, 365, 10_000]) expect(ids(availableIcons(reach(best), FREE))).toEqual(['default']);
  });

  it('offers Plus its own icon, Classic’s and the included themes’ from the start', () => {
    expect(ids(availableIcons(reach(0), PLUS))).toEqual(['default', 'classic', 'neon', 'mono', 'pastel']);
  });

  it('opens each earned theme’s icon at the same best streak as the theme', () => {
    const last = (best: number) => ids(availableIcons(reach(best), PLUS)).at(-1);
    expect(last(THEME_UNLOCK_EMBER - 1)).toBe('pastel');
    expect(last(THEME_UNLOCK_EMBER)).toBe('ember');
    expect(last(THEME_UNLOCK_AURORA - 1)).toBe('ember');
    expect(last(THEME_UNLOCK_AURORA)).toBe('aurora');
    expect(last(THEME_UNLOCK_GOLD - 1)).toBe('aurora');
    expect(ids(availableIcons(reach(THEME_UNLOCK_GOLD), PLUS))).toEqual(APP_ICON_IDS.filter((id) => id !== 'phoenix'));
  });

  it('opens Phoenix’s icon with the theme, after a comeback', () => {
    expect(ids(availableIcons({ best: 0, cameBack: true }, PLUS)).at(-1)).toBe('phoenix');
    expect(ids(availableIcons({ best: THEME_UNLOCK_GOLD, cameBack: true }, PLUS))).toEqual(APP_ICON_IDS);
    expect(keptIcon('phoenix', reach(400), PLUS)).toBe('default');
    expect(keptIcon('phoenix', { best: 0, cameBack: true }, PLUS)).toBe('phoenix');
  });

  it('follows the available themes at every best streak, and only grows', () => {
    let before = ids(availableIcons(reach(0), PLUS));
    for (let best = 0; best <= 400; best++) {
      const now = ids(availableIcons(reach(best), PLUS));
      expect(now).toEqual(['default', ...availableThemes(reach(best), { themesEnabled: true }).map((t) => t.id)]);
      expect(now.slice(0, before.length)).toEqual(before);
      before = now;
    }
  });
});

describe('the icon to keep', () => {
  it('keeps an icon that is still available', () => {
    expect(keptIcon('default', reach(0), PLUS)).toBe('default');
    expect(keptIcon('neon', reach(0), PLUS)).toBe('neon');
    expect(keptIcon('gold', reach(THEME_UNLOCK_GOLD), PLUS)).toBe('gold');
  });

  it('goes back to the app’s own icon when one isn’t earned, or in Win Zero', () => {
    expect(keptIcon('ember', reach(THEME_UNLOCK_EMBER - 1), PLUS)).toBe('default');
    expect(keptIcon('gold', reach(THEME_UNLOCK_GOLD - 1), PLUS)).toBe('default');
    for (const id of APP_ICON_IDS) expect(keptIcon(id, reach(400), FREE)).toBe('default');
  });

  it('after Erase all data (best 0), puts back the earned icons and keeps the included ones', () => {
    expect(keptIcon('gold', reach(0), PLUS)).toBe('default');
    expect(keptIcon('aurora', reach(0), PLUS)).toBe('default');
    expect(keptIcon('neon', reach(0), PLUS)).toBe('neon');
    expect(keptIcon('classic', reach(0), PLUS)).toBe('classic');
  });
});
