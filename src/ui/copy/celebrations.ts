// What Home's celebrations say (SPEC 6): a quote, congratulations, what the round earned, and a
// push to keep going. Each celebration in the engine's table has its words here, and its highlights
// come from what the round really earned. No "every day" or "a month": a goal on chosen days (Win
// Zero Plus) reaches these streaks over a longer stretch. Shared by the app and the website.
import {
  nextUnlock,
  SHIELD_CAP,
  SHIELD_EVERY,
  SLIDE_FINAL,
  themeById,
  weaponById,
  type Celebration,
  type CelebrationId,
  type GoalState,
  type HighlightKind,
  type ModeId,
} from '@/engine';
import type { RoundRecord } from '@/store/types';

import { powerUp } from './modes';

/** One thing the round earned, in its own panel. */
export interface Highlight {
  kind: HighlightKind;
  title: string;
  lines: string[];
}

/** A celebration's popup, top to bottom. */
export interface CelebrationCopy {
  title: string;
  quote: string;
  lines: string[];
  highlights: Highlight[];
  closing: string;
  button: string;
}

export interface CelebrationContext {
  round: RoundRecord;
  goal: GoalState;
  /** The shared arsenal's reach, for the next unlock. */
  best: number;
  gameMode: ModeId;
  /** This app's earned themes unlock app icons too (Win Zero Plus). */
  icons: boolean;
}

const KEEP_GOING = 'Keep going';

const HIGHLIGHTS: Record<HighlightKind, (c: CelebrationContext) => Highlight[]> = {
  shield: ({ round, goal }) =>
    round.rewards.shield
      ? [
          {
            kind: 'shield',
            title: 'You earned a shield',
            lines: [
              `You have ${goal.shields} of ${SHIELD_CAP}.`,
              `A hard stretch can't wipe out your run while you hold one. A slip still costs a zero, but when ${SLIDE_FINAL} in a row would start you over, your shield steps in and your streak stays. It works on its own, so there's nothing to do.`,
            ],
          },
        ]
      : [],
  weapon: ({ round, gameMode }) =>
    round.rewards.weapons.map((id) => {
      const p = powerUp(gameMode, weaponById(id));
      return { kind: 'weapon', title: `New ${p.kind}: ${p.name}`, lines: p.description ? [p.description] : [] };
    }),
  theme: ({ round, icons }) =>
    (round.unlocks ?? []).map((id) => ({
      kind: 'theme',
      title: `New theme: ${themeById(id).name}`,
      lines: [`Pick it in Settings › Themes.${icons ? ' Its app icon is unlocked too.' : ''}`],
    })),
  bomb: ({ round, goal }) =>
    round.rewards.bomb ? [{ kind: 'bomb', title: 'Bomb earned', lines: [`You have ${goal.bombs}.`] }] : [],
};

/** The next weapon's sentence, or nothing with all of them unlocked. */
function nextWeapon({ round, best, gameMode }: CelebrationContext): string {
  const next = nextUnlock(best, round.n);
  if (!next) return '';
  const p = powerUp(gameMode, next.weapon);
  return ` Your next ${p.kind}, the ${p.name}, comes on Day ${next.weapon.unlockAt}.`;
}

/** Each celebration's own words. Its title and button are the same for all. */
const WORDS: Record<CelebrationId, { quote: string; lines: (day: number) => string[]; closing: (c: CelebrationContext) => string }> = {
  'day-7': {
    quote: '“Success is the sum of small efforts, repeated day in and day out.”',
    lines: (day) => [`${day} zeros down, and every one of them is a promise you kept to yourself. That takes real strength.`],
    closing: ({ round, goal }) =>
      `${KEEP_GOING}. You've shown you can do this, one day at a time, and you're stronger now than when you started.${
        goal.shields < SHIELD_CAP ? ` Your next shield comes on Day ${round.n + SHIELD_EVERY}.` : ''
      }`,
  },
  'day-30': {
    quote: '“We are what we repeatedly do.”',
    lines: (day) => [`${day} zeros down. This is more than a good run now. It's who you're becoming, one check-in at a time.`],
    closing: (c) => `${KEEP_GOING}. Hard days may still come, and you've already shown you can get through them.${nextWeapon(c)}`,
  },
};

export function celebrationCopy(celebration: Celebration, context: CelebrationContext): CelebrationCopy {
  const words = WORDS[celebration.id];
  return {
    title: `Congratulations on Day ${celebration.day}!`,
    quote: words.quote,
    lines: words.lines(celebration.day),
    highlights: celebration.highlights.flatMap((kind) => HIGHLIGHTS[kind](context)),
    closing: words.closing(context),
    button: KEEP_GOING,
  };
}
