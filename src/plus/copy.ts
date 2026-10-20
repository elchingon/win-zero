// Win Zero Plus's own words (SPEC 9): its Settings sections, goal screens and Home with several
// goals. Plus-only, like everything in src/plus: Win Zero's bundle leaves them out. Supportive and
// plain, and nothing is ever for sale: a locked theme or icon says only what opens it.

export const GAMES_COPY = {
  title: 'Games',
  lede: 'Every round plays in the game you pick: your daily rounds, replays and bonus rounds.',
} as const;

export const THEMES_COPY = {
  title: 'Themes',
  lede: 'Colors for your rounds and the zeros drifting on Home.',
  /** A theme not yet earned. */
  opensAt: (best: number) => `Opens at a best streak of ${best}`,
  /** An earned theme, once it's open. */
  earnedAt: (best: number) => `Earned at a best streak of ${best}`,
} as const;

export const ICON_COPY = {
  title: 'App icon',
  lede: 'The icon on your home screen. Each theme has one, and it opens with the theme.',
  /** An icon's tile, read out: 'Ember icon', apart from the Ember theme. */
  spoken: (name: string) => `${name} icon`,
  /** On a locked icon's tile. */
  opensAt: (best: number) => `Opens at ${best}`,
  /** Read out for a locked icon. */
  opensWith: (theme: string, best: number) => `Opens with ${theme}, at a best streak of ${best}.`,
  confirmTitle: (name: string) => `Switch to the ${name} icon?`,
  /** Android closes the app if it was opened from the icon being replaced. */
  confirmBody: (app: string) => `${app} may close to make the change. Open it again from the new icon.`,
  confirm: 'Switch icon',
  cancel: 'Not now',
  unsupported: "This phone can't change app icons.",
  failed: "The icon didn't change. Try again in a moment.",
} as const;
