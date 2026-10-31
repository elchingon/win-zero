// What reminders say as check-in days go unanswered (SPEC 2). Pure. The jokes are about the zeros
// and the game, never the user, their goal or their lapse. Only a Yes is promised to stop the
// slide, since a Not today costs a zero. Days aren't counted: a goal may check in on chosen days.
import type { Lapse, LapseStage, ReminderKind } from '@/engine';

export interface LapseLine {
  title: string;
  /** The body's opening. schedule.ts finishes it with the question, or how to answer. */
  line: string;
}

interface Zeros {
  /** "12 zeros" or "1 zero". */
  count: string;
  They: string;
  they: string;
  them: string;
  their: string;
  are: string;
  /** A verb's ending: "they slip", "it slips". */
  s: string;
}

function zerosWords(n: number): Zeros {
  return n === 1
    ? { count: '1 zero', They: 'It', they: 'it', them: 'it', their: 'its', are: 'is', s: 's' }
    : { count: `${n} zeros`, They: 'They', they: 'they', them: 'them', their: 'their', are: 'are', s: '' };
}

/** From LAPSE_ENCOURAGE_FROM on. Also read by users with no zeros, so never mentions holding any. */
export const ENCOURAGE_LINES: readonly LapseLine[] = [
  { title: 'This game got awfully quiet', line: "One check-in and we're back in business." },
  { title: "Those zeros won't blast themselves", line: 'We checked. They just sit there.' },
  { title: 'Your next zero is pacing', line: "It's been asking about you. Come say hi." },
  { title: 'No lecture, promise', line: 'Just a game that saved your spot.' },
  { title: 'Hard week? We get it.', line: "Your spot's still here whenever you want it." },
  { title: 'Knock knock', line: "It's your next zero. It has no joke, it just misses you." },
];

const STAGE_LINES: Record<Exclude<LapseStage, 'encourage'>, readonly ((z: Zeros) => LapseLine)[]> = {
  warning: [
    (z) => ({
      title: `Your ${z.count} ${z.are} getting nervous`,
      line: `Free days are almost up. After that ${z.they} slip${z.s} away, then reset${z.s}. You can always start over, but we'd love to keep ${z.them}.`,
    }),
    (z) => ({
      title: `Your ${z.count} took a vote`,
      line: `${z.They} want${z.s} you back before the free days run out. We'd be sad to see ${z.them} go.`,
    }),
  ],
  slipping: [
    (z) => ({
      title: `Your ${z.count} could use you`,
      line: "Free days are over, so zeros slip one at a time. We're a little heartbroken. A Yes stops it.",
    }),
    (z) => ({
      title: `${z.count} and holding on`,
      line: 'Every missed day takes one now. A Yes stops the slide.',
    }),
  ],
  'last-call': [
    (z) => ({
      title: `Last call for your ${z.count}`,
      line: `Miss this one and ${z.they} reset${z.s}. We'd be sad to see ${z.them} go, but you can always start over.`,
    }),
    (z) => ({
      title: `Your ${z.count} ${z.are} packing ${z.their} bags`,
      line: `We're sad to see ${z.them} go. A Yes keeps ${z.them}, or start over whenever you're ready.`,
    }),
  ],
};

/**
 * A lapse reminder's words. Turns by day and kind, so back to back they differ, and the same
 * reminder always reads the same, so a reschedule doesn't change it.
 */
export function lapseLine(lapse: Lapse, kind: ReminderKind): LapseLine {
  const turn = 2 * lapse.missedInRow + (kind === 'morning' ? 1 : 0);
  if (lapse.stage === 'encourage') return ENCOURAGE_LINES[turn % ENCOURAGE_LINES.length]!;
  const lines = STAGE_LINES[lapse.stage];
  return lines[turn % lines.length]!(zerosWords(lapse.zeros));
}
