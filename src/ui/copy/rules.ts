// The rules in plain words: Setup's list, How it works, and the goal field's suggestions. Numbers
// come from the engine, so the copy can't drift from the rules. Shared by the app and the
// website; the website has no notifications, so How it works leaves those lines out there.
import {
  BOMB_EVERY,
  clockMinutes,
  MISSED_GRACE_DAYS,
  SHIELD_CAP,
  SHIELD_EVERY,
  SLIDE_FINAL,
  type AnswerRejection,
  type ClockTime,
} from '@/engine';
import { UNDO_MS } from '@/store/createAppStore';

import { CREDIT_USES, creditsEarnedBy } from './credits';

export const GOAL_MAX_LENGTH = 60;
export const SUGGESTIONS = ['Stop drinking', 'Exercise more', 'Quit vaping', 'No phone after 10pm', 'Read 20 minutes'];

/** When the reminder comes, in words: later the same day, the next day, or with the check-in. */
export function reminderWhen(checkIn: ClockTime, reminder: string, morning: ClockTime): string {
  const after = clockMinutes(morning) - clockMinutes(checkIn);
  if (after === 0) return "If you haven't answered, the next day's check-in asks again, so it's one notification a day.";
  return `Once more at ${reminder} ${after > 0 ? 'that day' : 'the next day'} if you haven't answered yet.`;
}

export interface Rule {
  mark: string;
  tone?: 'flare';
  text: string;
}

/** Setup's rules, beside their marks. */
export const RULES: Rule[] = [
  { mark: '?', text: 'Each evening at your check-in time, Win Zero asks one question: did you do it today?' },
  { mark: '000', text: 'Yes adds a zero. Shoot every one of them. The last zero goes out with a huge explosion.' },
  {
    mark: '−1',
    tone: 'flare',
    text: 'Not today costs one zero. Seven in a row starts a fresh run, unless a shield saves it. You earn a shield every 7 days.',
  },
  { mark: '7D', text: "Missed a check-in? Nothing's lost for a week. After that, each missed day counts like a Not today." },
  { mark: '+', text: 'Longer streaks unlock new weapons, and every 5 days earns a bomb.' },
];

/** Home's banner when an answer was turned down. */
export const REJECTED: Record<AnswerRejection, string> = {
  expired: "That check-in closed before your answer. Here's where things stand now.",
  'already-answered': "You've already answered that one.",
  'not-open': "That check-in isn't open yet.",
};

export interface Section {
  title: string;
  body: string[];
}

/**
 * How it works, reached from Settings: where to look at the rules again, and where the words the
 * notices use ("the slide", "a fresh run", "banked") are explained. `notifications`: the app
 * sends reminders; the website doesn't.
 */
export function howItWorks({ notifications }: { notifications: boolean }): Section[] {
  const only = (on: boolean, ...lines: string[]) => (on ? lines : []);
  return [
    {
      title: 'The daily question',
      body: [
        notifications
          ? 'Each day at your check-in time, Win Zero asks one question: did you stick to your goal today? Answer Yes or Not today, from the notification or from Home.'
          : 'Each day at your check-in time, Win Zero asks one question: did you stick to your goal today? Answer Yes or Not today on Home.',
        notifications
          ? "There's no rush. You can answer until midnight the next day, and if you haven't by your reminder time, one more reminder comes."
          : "There's no rush. You can answer until midnight the next day.",
      ],
    },
    {
      title: 'Yes adds a zero',
      body: [
        'Each Yes adds a zero to your streak and opens a round with that many zeros to shoot. The last one goes out with a big explosion.',
        "Rewards are banked the moment you say Yes: they're yours whether you play the round now, later, or not at all. An unplayed round waits on Home until the next day's check-in is answered or closes.",
      ],
    },
    {
      title: 'Not today, and the slide',
      body: [
        "Not today costs one zero. That's the slide: each slip since your last Yes takes one zero, and your next Yes stops it.",
        `If slips reach ${SLIDE_FINAL} before your next Yes, that one is the final. A shield takes it if you have one, and your streak stays. If not, your streak starts over: a fresh run. Your best run, weapons and bombs stay yours.`,
        `Tapped Not today by mistake? You can undo it for ${UNDO_MS / 1000} seconds on the screen that follows, a little longer with a screen reader on.`,
      ],
    },
    {
      title: 'Missed check-ins',
      body: [
        `Life gets busy. Missed check-ins cost nothing for the first ${MISSED_GRACE_DAYS} days in a row. After that, each missed day counts as a slip.`,
        ...only(
          notifications,
          "If a long break starts a fresh run, daily reminders pause. With Weekly nudge on in Settings, you'll get one gentle reminder a week. Answering any check-in brings daily reminders back.",
        ),
      ],
    },
    {
      title: 'Shields, bombs and weapons',
      body: [
        `Every ${SHIELD_EVERY} days of streak earns a shield, up to ${SHIELD_CAP} at a time. Shields only step in on the final slip, never on an ordinary one.`,
        `Every ${BOMB_EVERY} days earns a bomb to use in a round. New weapons unlock as your best run grows. Bombs and weapons are never lost.`,
        "Shields and bombs come from new highs in a run, so slipping and climbing back doesn't earn the same ones twice.",
      ],
    },
    {
      title: 'Credits',
      body: [
        CREDIT_USES.game,
        CREDIT_USES.weapon,
        [creditsEarnedBy('game'), creditsEarnedBy('weapon'), 'Each one is earned once, and they stay banked until you use them.']
          .filter(Boolean)
          .join(' '),
      ],
    },
  ];
}
