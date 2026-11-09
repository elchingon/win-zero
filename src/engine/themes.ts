// Themes (SPEC 9). Win Zero Plus recolors the round and Home's drifting zeros in the theme picked
// in Settings › Themes; Win Zero, and the website, are always Classic. Four themes come with Plus,
// and three are earned by the shared best streak (the arsenal's reach), which never goes down, so
// an earned theme is never lost. A comeback theme opens once any goal has come back after a reset
// (comeback.ts), which is never lost either. The colors live in theme/themes.ts; this is only which
// and when.

export type ThemeId = 'classic' | 'neon' | 'mono' | 'pastel' | 'ember' | 'aurora' | 'gold';

/**
 * Classic is every app's; the included themes come with Plus; the earned ones need a best streak,
 * and a comeback theme a comeback after a reset.
 */
export type ThemeSource = 'free' | 'included' | 'earned' | 'comeback';

export interface ThemeDef {
  id: ThemeId;
  name: string;
  source: ThemeSource;
  /** The best streak that opens an earned theme; THEME_FROM_START for the others. */
  unlockAt: number;
}

/** How far the player has come, for which themes are open. */
export interface ThemeReach {
  /** The shared arsenal's reach (weapons.ts arsenalReach). */
  best: number;
  /** A goal has come back after a reset (comeback.ts cameBackAfterReset). */
  cameBack: boolean;
}

/** The free game's look (SPEC 7), and every app's fallback. */
export const DEFAULT_THEME: ThemeId = 'classic';
/** Classic and the included themes need no streak. */
export const THEME_FROM_START = 0;
export const THEME_UNLOCK_EMBER = 30;
export const THEME_UNLOCK_AURORA = 180;
export const THEME_UNLOCK_GOLD = 365;

export const THEMES: readonly ThemeDef[] = [
  { id: 'classic', name: 'Classic', source: 'free', unlockAt: THEME_FROM_START },
  { id: 'neon', name: 'Neon Arcade', source: 'included', unlockAt: THEME_FROM_START },
  { id: 'mono', name: 'Mono CRT', source: 'included', unlockAt: THEME_FROM_START },
  { id: 'pastel', name: 'Pastel', source: 'included', unlockAt: THEME_FROM_START },
  { id: 'ember', name: 'Ember', source: 'earned', unlockAt: THEME_UNLOCK_EMBER },
  { id: 'aurora', name: 'Aurora', source: 'earned', unlockAt: THEME_UNLOCK_AURORA },
  { id: 'gold', name: 'Gold Year', source: 'earned', unlockAt: THEME_UNLOCK_GOLD },
];

export const THEME_IDS: readonly ThemeId[] = THEMES.map((t) => t.id);

export interface ThemeOptions {
  /** This app offers themes beyond Classic (Win Zero Plus). */
  themesEnabled: boolean;
}

export function isThemeId(v: unknown): v is ThemeId {
  return THEME_IDS.some((id) => id === v);
}

export function themeById(id: ThemeId): ThemeDef {
  const t = THEMES.find((x) => x.id === id);
  if (!t) throw new RangeError(`Unknown theme: ${id}`);
  return t;
}

/** True when `t` is open at `reach`, wherever themes are offered. */
export function themeOpen(t: ThemeDef, reach: ThemeReach): boolean {
  return t.source === 'comeback' ? reach.cameBack : t.unlockAt <= reach.best;
}

/** The themes a player can pick: just Classic in Win Zero; in Plus, every theme open at `reach`. */
export function availableThemes(reach: ThemeReach, { themesEnabled }: ThemeOptions): ThemeDef[] {
  if (!themesEnabled) return [themeById(DEFAULT_THEME)];
  return THEMES.filter((t) => themeOpen(t, reach));
}

/** The player's pick while it's available, otherwise Classic. */
export function equippedTheme(pick: ThemeId | null, reach: ThemeReach, opts: ThemeOptions): ThemeId {
  return pick && availableThemes(reach, opts).some((t) => t.id === pick) ? pick : DEFAULT_THEME;
}

/** Earned and comeback themes that open going from `prev` to `next`, for the result sheet. */
export function newlyUnlockedThemes(prev: ThemeReach, next: ThemeReach, opts: ThemeOptions): ThemeDef[] {
  return availableThemes(next, opts).filter((t) => (t.source === 'earned' || t.source === 'comeback') && !themeOpen(t, prev));
}
