// Home's one-time tips (SPEC 6). After the first Yes's round: a word for starting, how the app
// works in a few lines, and when to come back. Supportive and plain; a Not today is part of the
// plan, not a failure. Shared by the app and the website.
import { formatCount } from '@/lib/format';

/** A tip's popup: a title, a few lines, and its button. */
export interface TipCopy {
  title: string;
  lines: string[];
  button: string;
}

/**
 * After the first Yes's round is played. `next`: the next round's zeros. `nextWhen`: when the next
 * check-in opens, as Home says it ("tomorrow at 8:00 PM"). `everyDay`: the goal checks in every
 * day, as in Win Zero; otherwise (Win Zero Plus, SPEC 9) on the days picked. `earnedCredit`: the
 * Yes earned a Game credit.
 */
export function firstRoundTip({
  next,
  nextWhen,
  everyDay = true,
  earnedCredit,
}: {
  next: number;
  nextWhen: string;
  everyDay?: boolean;
  earnedCredit: boolean;
}): TipCopy {
  return {
    title: 'Day one, done.',
    lines: [
      '“A journey of a thousand miles begins with a single step.” You just took it.',
      `How it works: stick to your goal ${everyDay ? 'each day' : 'on each check-in day'}, then check in. Every Yes adds a zero, so your next round has ${formatCount(next)} to shoot.`,
      'A Not today costs one zero, and your next Yes gets you climbing again.',
      ...(earnedCredit ? ['You earned a Game credit for starting. Spend it on a bonus round any time.'] : []),
      `Your next check-in is ${nextWhen}.`,
    ],
    button: "Let's go",
  };
}
