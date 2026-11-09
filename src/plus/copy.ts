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
  /** Phoenix, before and after a comeback after a reset opens it. */
  opensOnComeback: 'Opens when you come back after starting over',
  earnedOnComeback: 'Earned by coming back after starting over',
} as const;

export const ICON_COPY = {
  title: 'App icon',
  lede: 'The icon on your home screen. Each theme has one, and it opens with the theme.',
  /** An icon's tile, read out: 'Ember icon', apart from the Ember theme. */
  spoken: (name: string) => `${name} icon`,
  /** On a locked icon's tile. */
  opensAt: (best: number) => `Opens at ${best}`,
  /** On Phoenix's tile while it's locked. */
  opensOnComeback: 'After a comeback',
  /** Read out for a locked icon. */
  opensWith: (theme: string, best: number) => `Opens with ${theme}, at a best streak of ${best}.`,
  /** Read out for Phoenix's icon while it's locked. */
  opensWithComeback: (theme: string) => `Opens with ${theme}, when you come back after starting over.`,
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

export const HEAD_START_COPY = {
  label: 'Days already done',
  hint: (max: number) =>
    `Already doing this? Count the days in a row you've done it, up to ${max}. They go in as Yes days, and stay that way.`,
  invalid: (max: number) => `A whole number from 0 to ${max}.`,
  /** The chip for no head start. */
  none: 'None',
  /** What it starts the goal with: 'You start with 12 zeros, 2 bombs and a shield. Your first Yes makes 13.' */
  preview: (gear: string, first: number) => `You start with ${gear}. Your first Yes makes ${first}.`,
  /** What it opens beyond what's open already: 'It opens the Rocket and the Ember theme.' */
  opens: (what: string) => `It opens ${what}.`,
  /** The first-round tip's opening, for a goal that came in with one: its first check-in isn't day one. */
  tip: {
    title: 'First check-in, done.',
    line: 'You came in already on a roll, and now it counts here too. Keep it going.',
  },
} as const;

/**
 * The encouragement over a comeback's round (SPEC 9), in place of the usual cheer: coming back is
 * the brave part. Never how long they were away, and nothing that frames the gap as a failure.
 */
export const COMEBACK_CHEERS: readonly string[] = [
  "You came back. That's the hardest part, and you did it.",
  "Starting again takes guts. You've got plenty.",
  'Welcome back. The zeros missed you.',
  'Every comeback starts with one check-in. This was it.',
  "You didn't give up on yourself. That's what counts.",
  'Back in the game, and right on target.',
  'Falling down is part of it. Getting back up is all you.',
  "Look who's back. Let's keep this going.",
];

/**
 * Home's welcome back (SPEC 9), once a comeback's round has been played: a quote about getting back
 * up, then why coming back counts, and the win-back round. Never how long they were away.
 */
export const WELCOME_COPY = {
  title: 'Welcome back.',
  /** One per comeback, by its day. */
  quotes: [
    '“Fall seven times, stand up eight.”',
    '“Our greatest glory is not in never falling, but in rising every time we fall.”',
    '“It does not matter how slowly you go, as long as you do not stop.”',
  ],
  lines: (reset: boolean) => [
    'Coming back is the bravest part of any goal, and you just did it.',
    reset
      ? 'Starting over takes more than starting did. Your new run is on the board.'
      : 'Your streak is climbing again, one check-in at a time.',
  ],
  winBack: {
    title: 'Win-back round',
    line: (n: string) => `A free round of ${n} zeros, as many as you came back from. Blast them for fun: your streak stays as it is.`,
  },
  /** When an earlier comeback's win-back round still waits. */
  waiting: 'Your win-back round from before is still waiting on Home.',
  phoenix: {
    title: (name: string) => `New theme: ${name}`,
    line: 'Earned only by coming back after starting over. It’s yours for good, with its own app icon.',
  },
  play: 'Play the win-back round',
  later: 'Later',
  close: 'Keep going',
} as const;

/** The win-back round's own name, in the round and on its sheet. */
export const WIN_BACK_WORDS = {
  hud: 'COMEBACK',
  eyebrow: 'Win-back round',
  lede: "Win-back round: your streak and rewards don't change.",
} as const;

/** Home's card while a win-back round waits to be played. */
export const WIN_BACK_COPY = {
  title: (n: string) => `Win-back round: ${n} zeros`,
  lede: 'A comeback’s gift. Your streak stays as it is, whatever happens in the round.',
  play: 'Play it',
} as const;

/** The history calendar's words for the Yeses Win Zero Plus marks apart. */
export const CALENDAR_NOTES = { headStart: 'Head start', comeback: 'Comeback' } as const;

/** Plus's own tiles on a goal's stats. */
export const STATS_COPY = { comebacks: 'Comebacks', headStart: 'Head start' } as const;

export const GOALS_COPY = {
  title: 'Goals',
  add: 'Add a goal',
  addHint: 'Opens a new goal to fill in',
  addDetail: (max: number) => `Up to ${max}, each with its own check-ins and streak.`,
  /** With room for `n` more. */
  addMore: (n: number) => (n === 1 ? '1 more fits.' : `${n} more fit.`),
  full: (max: number) => `All ${max} goals are in use. Archive or delete one to add another.`,
} as const;

export const ADD_GOAL_COPY = {
  title: 'Add a goal',
  lede: 'Each goal has its own check-ins, streak and round. Weapons, credits and themes are shared.',
  field: 'Your goal',
  placeholder: "Something you'll do, or stop doing",
  add: 'Add goal',
  full: (max: number) => `All ${max} goals are in use. Archive or delete one in Settings to make room for a new one.`,
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
  /** What it reached, on the card that asks: 'Best run 41 days · 63 Yes days'. */
  reached: (best: string, yes: string) => `Best run ${best} · ${yes}`,
  body: 'Its reminders stop and its slot frees up. Its history stays under Past goals, and what it unlocked stays yours.',
  confirm: 'Archive goal',
  cancel: 'Keep it',
} as const;

/** A goal that can't be archived yet (best run short of ARCHIVE_MIN_BEST) can be deleted. */
export const DELETE_COPY = {
  link: 'Delete this goal',
  hint: 'Asks first',
  /** Under the link: why there's no Archive yet. */
  why: (min: number) =>
    `Once a goal reaches ${min} zeros, it can be archived and keep its history under Past goals. Until then, it can be deleted.`,
  title: (goal: string) => `Delete “${goal}”?`,
  body: "Its history leaves this phone and can't come back. What it unlocked stays yours.",
  confirm: 'Delete goal',
  cancel: 'Keep it',
} as const;

/** On the card that asks, when the goal is the only one. */
export const LAST_GOAL_COPY = "It's your only goal, so you'll set up a new one next.";

export const PAST_COPY = {
  title: 'Past goals',
  /** Settings' row: how many. */
  count: (n: number) => (n === 1 ? '1 goal' : `${n} goals`),
  lede: (max: number) => `Goals you've archived keep their history here. They have no reminders, and don't count toward your ${max}.`,
  none: 'No past goals.',
  /** Settings' row with none yet. */
  noneYet: (min: number) => `None yet. A goal that reaches ${min} zeros can come here when you’re done with it.`,
  view: 'View',
  /** Settings' row, and Setup's link. */
  openHint: "Opens the goals you've archived",
  rowHint: "Opens this goal's history",
  /** Under its name: 'Best run 41 days · 63 Yes days · archived Oct 3'. */
  detail: (best: string, yes: string, day: string) => `Best run ${best} · ${yes} · archived ${day}`,
  /** Over the list: every past goal added up. */
  totals: { goals: 'Past goals', yesDays: 'Yes days', bestRun: 'Best run', comebacks: 'Comebacks' },
  /** One past goal's numbers. */
  stats: {
    bestRun: 'Best run',
    yesDays: 'Yes days',
    headStart: (n: number) => `${n} from a head start`,
    answered: 'Check-ins',
    comebacks: 'Comebacks',
    shieldsUsed: 'Shields used',
    days: 'Days on this goal',
  },
  milestones: 'Milestones',
  /** Read out for the milestones row: 'Reached Day 7, Day 14 and Day 30. Not reached: Day 60 …'. */
  milestonesSpoken: (reached: string, rest: string) =>
    `${reached ? `Reached ${reached}.` : 'None reached.'}${rest ? ` Not reached: ${rest}.` : ''}`,
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
