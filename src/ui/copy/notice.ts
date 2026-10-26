// What the Notice screen says: Reset / Shielded / Slipping, what a Not today or a run of missed
// days did to the streak. The copy is supportive and plain: some people here are working on
// sobriety. Shared by the app and the website, so it reads the same on both.
import { MISSED_GRACE_DAYS } from '@/engine';
import { plural } from '@/lib/format';
import type { Notice } from '@/store/types';
import { colors } from '@/theme/tokens';

/** How the notice's big zero moves: a reset settles in, a shield pulses, a slip sheds a zero. */
export type NoticeMotion = 'settle' | 'absorb' | 'shed' | 'none';

/** The zero's color for each kind of notice. */
export const noticeColors = { reset: colors.flare, shielded: colors.teal, slipping: colors.amber, noted: colors.amber };

export interface NoticeCopy {
  eyebrow: string;
  title: [before: string, em: string];
  body: string[];
  motion: NoticeMotion;
  support?: boolean;
}

/** What a reset leaves. Not shields: a reset almost always comes with none left. */
export const KEEPSAKES = 'your weapons and bombs are still yours';
/** Read out when a Not today is taken back. */
export const UNDONE = 'Undone. Your check-in is open again.';

/**
 * What the Notice screen says about `n`, and how its zero moves. `everyDay`: the goal checks in
 * every day, as every Win Zero goal does; otherwise (Win Zero Plus, SPEC 9) the free misses are
 * counted in check-ins rather than as a week.
 */
export function copyFor(n: Notice, { everyDay = true }: { everyDay?: boolean } = {}): NoticeCopy {
  switch (n.kind) {
    case 'slipping': {
      const zerosOff = n.lost === 1 ? 'One zero ' : `${n.lost} zeros `;
      if (n.cause === 'answer') {
        return {
          eyebrow: 'Not today',
          title: [zerosOff, 'came off.'],
          body: [
            'Thanks for being honest.',
            n.streak > 0
              ? `Your streak is at ${plural(n.streak, 'zero')}. A Yes at your next check-in stops the slide.`
              : 'A Yes at your next check-in starts a new run.',
          ],
          motion: 'shed',
          support: true,
        };
      }
      return {
        eyebrow: 'While you were away',
        title: [zerosOff, 'came off.'],
        body: [
          n.stopped
            ? `Your Yes stopped the slide. Your streak is at ${plural(n.streak, 'zero')}.`
            : `Check in to stop the slide. Your streak is at ${plural(n.streak, 'zero')}.`,
          everyDay
            ? 'Missed days are free for a week; after that, each one takes a zero.'
            : `The first ${MISSED_GRACE_DAYS} missed check-ins in a row are free; after that, each one takes a zero.`,
        ],
        motion: 'shed',
        support: true,
      };
    }
    case 'shielded':
      return {
        eyebrow: n.cause === 'answer' ? 'Shield used' : 'While you were away',
        title: ['Your shield ', 'held.'],
        body: [
          n.cause === 'answer'
            ? `That Not today would have started a fresh run, so a shield stepped in. Your streak stays at ${plural(n.streak, 'zero')}.`
            : n.lost > 0
              ? `${plural(n.lost, 'zero')} came off while you were away, and then a shield stopped the slide. Your streak is at ${plural(n.streak, 'zero')}.`
              : `A shield kept your streak at ${plural(n.streak, 'zero')}.`,
          `The slide starts over. Shields left: ${n.shieldsLeft}.`,
        ],
        motion: 'absorb',
      };
    case 'reset':
      return n.cause === 'answer'
        ? {
            eyebrow: 'A fresh start',
            title: ['Back to ', 'zero.'],
            body: [
              "Thanks for being honest. Hard stretches happen, and you're still here checking in.",
              `Your next Yes starts a new run. Your best run stays on the board at ${plural(n.bestStreak, 'day')}, and ${KEEPSAKES}.`,
            ],
            motion: 'settle',
            support: true,
          }
        : {
            eyebrow: 'Welcome back',
            title: ['A fresh ', 'start.'],
            body: [
              "It's been a while since your last check-in, so your streak has started over.",
              n.stopped
                ? `Your Yes started a new run. Your best run stays at ${plural(n.bestStreak, 'day')}, and ${KEEPSAKES}.`
                : `Your best run stays at ${plural(n.bestStreak, 'day')}, and ${KEEPSAKES}. Check in whenever you're ready.`,
            ],
            motion: 'settle',
            support: true,
          };
    case 'noted':
      return {
        eyebrow: 'Not today',
        title: ['Thanks for ', 'checking in.'],
        body: ['Honest answers keep the streak real. A Yes at your next check-in puts your first zero on the board.'],
        motion: 'none',
      };
  }
}
