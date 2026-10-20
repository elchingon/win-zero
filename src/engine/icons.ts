// App icons (SPEC 9). Win Zero Plus offers its own icon and one per theme, and a theme's icon opens
// with the theme: the included themes' from the start, an earned theme's at its best streak, never
// lost because that best never goes down. Win Zero has only its own. The phone remembers which
// icon is showing, so nothing here is saved; this is only which icons and when.
// Not in the engine's index: only Win Zero Plus's code reads it, so Win Zero's bundle leaves it out.
import { availableThemes, THEME_FROM_START, THEMES, type ThemeId } from './themes';

/** 'default' is the app's own icon; the rest are named for their themes. */
export type AppIconId = 'default' | ThemeId;

export const DEFAULT_ICON: AppIconId = 'default';

export interface AppIconDef {
  id: AppIconId;
  /** The theme it's drawn in, and opens with; null for the app's own icon. */
  theme: ThemeId | null;
  /** The best streak that opens it. */
  unlockAt: number;
}

export const APP_ICONS: readonly AppIconDef[] = [
  { id: DEFAULT_ICON, theme: null, unlockAt: THEME_FROM_START },
  ...THEMES.map((t) => ({ id: t.id, theme: t.id, unlockAt: t.unlockAt })),
];

export const APP_ICON_IDS: readonly AppIconId[] = APP_ICONS.map((i) => i.id);

export interface IconOptions {
  /** This app offers icons beyond its own (Win Zero Plus). */
  iconsEnabled: boolean;
}

export function isAppIconId(v: unknown): v is AppIconId {
  return APP_ICON_IDS.some((id) => id === v);
}

/** The icons a player can pick: just the app's own in Win Zero; in Plus, its own and every open theme's. */
export function availableIcons(best: number, { iconsEnabled }: IconOptions): AppIconDef[] {
  if (!iconsEnabled) return APP_ICONS.filter((i) => i.id === DEFAULT_ICON);
  const open = availableThemes(best, { themesEnabled: true });
  return APP_ICONS.filter((i) => i.theme === null || open.some((t) => t.id === i.theme));
}

/** The icon to keep showing: `current` while it's available, otherwise the app's own. */
export function keptIcon(current: AppIconId, best: number, opts: IconOptions): AppIconId {
  return availableIcons(best, opts).some((i) => i.id === current) ? current : DEFAULT_ICON;
}
