// Win Zero Plus's own words (SPEC 9): its Settings sections, goal screens and Home with several
// goals. Plus-only, like everything in src/plus: Win Zero's bundle leaves them out. Supportive and
// plain, and nothing is ever for sale: a locked theme or icon says only what opens it.
import { SECRET_GAME_CREDITS } from '@/engine';
import { creditCount, type CreditNews } from '@/ui/copy/credits';

export const GAMES_COPY = {
  title: 'Games',
  lede: 'Your go-to game. You can pick another before each new round, and a replay keeps the game you played.',
  /** Each game's row, for screen readers. */
  optionHint: 'Comes up first before each new round',
} as const;

/** Home's secret: three quick taps on the Game credits count give a free one, as often as found. */
export const SECRET_COPY = {
  news: (balance: number): CreditNews => ({
    badge: `+${SECRET_GAME_CREDITS}`,
    title: SECRET_GAME_CREDITS === 1 ? 'Free Game credit!' : 'Free Game credits!',
    lines: ['You found the secret stash.', `You now have ${creditCount('game', balance)}. Go on, play a bonus round.`],
    button: 'Sweet!',
  }),
  /** The last line of Settings › Games: a nudge, not a map. */
  hint: "Psst. Somewhere on Home, a little box hands out free games to anyone who knocks three times. You didn't hear it from us.",
} as const;

/** Before a round not yet played: which game to play it in. */
export const MODE_PICKER = {
  title: 'Pick your game',
  body: 'Same zeros, your way. Tap a game to play this round in it.',
  /** On the game picked last. */
  current: 'Last pick',
  optionHint: 'Plays this round in this game',
  /** One game, read out: 'Catch, your last pick. Slide anywhere to catch the zeros. Catcher: Cup.' */
  option: (name: string, hint: string, tier: string, last: boolean) => `${name}${last ? ', your last pick' : ''}. ${hint}. ${tier}.`,
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
  addHint: 'Opens a new goal to fill in',
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

/** Settings' own words, as they read with several goals, or past ones. */
export const SETTINGS_COPY = {
  erase: "This deletes your goals, past goals, streaks, history and rewards from this phone. It can't be undone.",
  goalInReminders:
    'Off keeps your goals private on the lock screen. Reminders use a goal’s lock-screen name, or “your second goal”.',
} as const;

export const GOAL_COPY = {
  /** Read out on a goal's row in Settings. */
  rowHint: "Opens this goal's settings",
  edit: 'Edit',
  aliasLabel: 'Lock-screen name',
  aliasHint: 'With Goal in reminders off, reminders call this goal by this name instead.',
  aliasSaved: 'Saved. With Goal in reminders off, reminders call this goal by this name instead.',
  aliasSave: 'Save name',
  aliasClear: 'Clear name',
} as const;

export const ARCHIVE_COPY = {
  link: 'Archive this goal',
  hint: 'Asks first. Its history stays under Past goals.',
  title: (goal: string) => `Archive “${goal}”?`,
  body: 'Its reminders stop and its slot frees up. Its history stays under Past goals, and what it unlocked stays yours.',
  confirm: 'Archive goal',
  cancel: 'Keep it',
} as const;

export const PAST_COPY = {
  title: 'Past goals',
  /** Settings' row: how many. */
  count: (n: number) => (n === 1 ? '1 goal' : `${n} goals`),
  lede: (max: number) => `Goals you've archived keep their history here. They have no reminders, and don't count toward your ${max}.`,
  none: 'No past goals.',
  view: 'View',
  rowHint: "Opens this goal's history",
  /** Under its name: 'Archived Oct 3 · best run 41 days'. */
  detail: (day: string, best: string) => `Archived ${day} · best run ${best}`,
  archived: (day: string) => `Archived ${day}`,
  deleteLink: 'Delete for good',
  deleteHint: 'Asks first',
  deleteTitle: (goal: string) => `Delete “${goal}” for good?`,
  deleteBody: "Its history leaves this phone and can't come back. Weapons and themes it unlocked stay yours.",
  deleteConfirm: 'Delete for good',
  deleteCancel: 'Keep it',
} as const;

export const HOME_COPY = {
  /** Below the check-ins: the picked goal's numbers, or the shared credits and arsenal. */
  tabs: { goals: 'Goals', game: 'Game' },
  yourGoals: 'Your goals',
  /** Beside Your goals, while there's room for another. */
  addGoal: 'Add goal',
  pickHint: 'Shows its stats and history',
  /** Over the goals with nothing open: all of them, or some. */
  caughtUp: "You're all caught up.",
  upNext: 'Up next',
  /** 'Run: Monday at 7:00 AM'. */
  nextCheckIn: (goal: string, when: string) => `${goal}: ${when}`,
  paused: (goal: string) =>
    `Reminders for “${goal}” are paused after a long break. Check in whenever you're ready and they'll pick back up.`,
} as const;
