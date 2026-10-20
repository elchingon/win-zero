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

export const DAYS_COPY = {
  label: 'Check-in days',
  /** Under the picker when a goal is set up. */
  hint: 'Rest days have no check-in, so nothing is gained or lost on them.',
  /** Under the picker for a goal already running. */
  changeHint:
    "Changes start from the next check-in day that hasn't opened yet. Days already answered, or open now, stay as they are.",
  /** While a change waits: 'These days start Friday.' */
  starts: (when: string) => `These days start ${when}.`,
  save: 'Save days',
  /** On the only day left on. */
  lastDay: 'At least one day stays on',
} as const;

export const GOALS_COPY = {
  title: 'Goals',
  add: 'Add a goal',
  addDetail: (max: number) => `Up to ${max}, each with its own check-ins and streak.`,
  /** With room for `n` more. */
  addMore: (n: number) => (n === 1 ? '1 more fits.' : `${n} more fit.`),
  full: (max: number) => `All ${max} goals are in use. Archive one to add another.`,
} as const;

export const ADD_GOAL_COPY = {
  title: 'Add a goal',
  lede: 'Each goal has its own check-ins, streak and round. Weapons, credits and themes are shared.',
  field: 'Your goal',
  placeholder: "Something you'll do, or stop doing",
  add: 'Add goal',
  full: (max: number) => `All ${max} goals are in use. Archive one in Settings to make room for a new one.`,
  back: 'Back to Settings',
} as const;
