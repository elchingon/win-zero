// What each answer on the check-in card would do, in plain words: shown under the question, and
// read out as each button's hint.
import { notTodayPreview, type GoalState } from '@/engine';
import { plural } from '@/lib/format';

export interface Stakes {
  /** "6 zeros to shoot" */
  yes: string;
  /** "one zero comes off", or null when a Not today would cost nothing. */
  notToday: string | null;
}

export function checkInStakes(goal: GoalState): Stakes {
  const no = notTodayPreview(goal);
  const notToday =
    no.kind === 'shield'
      ? 'a shield keeps your streak'
      : no.lose === 0
        ? null
        : no.kind === 'reset'
          ? 'a fresh start, from one zero'
          : 'one zero comes off';
  return { yes: `${plural(goal.streak + 1, 'zero')} to shoot`, notToday };
}

/** "Yes: 6 zeros to shoot. Not today: one zero comes off." */
export function stakesLine({ yes, notToday }: Stakes): string {
  return notToday ? `Yes: ${yes}. Not today: ${notToday}.` : `Yes: ${yes}.`;
}

/** As a button's hint, a sentence: "one zero comes off" becomes "One zero comes off." */
export function stakesHint(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
