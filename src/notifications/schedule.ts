// The engine's reminder plan as local notification requests (SPEC 2). Pure: the engine decides
// which reminders are due and when; this only adds the words, ids, buttons and triggers.
import {
  SchedulableTriggerInputTypes,
  type DateTriggerInput,
  type NotificationContentInput,
  type NotificationRequestInput,
  type TimeIntervalTriggerInput,
} from 'expo-notifications';

import {
  diffDays,
  isWindowToday,
  nextWindow,
  planReminders,
  resolve,
  windowFor,
  type DayKey,
  type GoalState,
  type PlannedReminder,
  type TimeZone,
} from '@/engine';

import { CHECKIN_CATEGORY_ID, CHECKIN_CHANNEL_ID, type ReminderData } from './shared';

/** iOS keeps at most this many pending notifications per app and drops the rest. */
export const IOS_PENDING_LIMIT = 64;
/** Slots left free under the iOS limit, for a dev test notification. */
export const PENDING_RESERVE = 4;
export const MAX_SCHEDULED = IOS_PENDING_LIMIT - PENDING_RESERVE;
/** The dev tools' test check-in arrives this long after it's sent. */
export const TEST_DELAY_SECONDS = 10;

const CHECKIN_TITLE = 'Daily check-in';
const MORNING_TITLE = 'Still time to check in';

/** The weekly nudge, one per week in turn. Never names the goal; never counts what was missed. */
export const NUDGES: readonly { title: string; body: string }[] = [
  { title: "Whenever you're ready", body: 'One check-in is all it takes to pick things back up.' },
  { title: 'Still here for you', body: "No pressure. Answer today's check-in whenever it feels right." },
  { title: 'Your next zero is waiting', body: "Check in when you're ready, and we'll pick up from there." },
];

type ReminderContent = NotificationContentInput & { title: string; body: string; data: ReminderData };

export type ReminderRequest = NotificationRequestInput & {
  identifier: string;
  content: ReminderContent;
  trigger: DateTriggerInput & { date: Date };
};

export interface ReminderInput {
  goal: GoalState;
  /** The app's clock. */
  now: Date;
  /** The device time zone. */
  tz: TimeZone;
  /**
   * How far the app's clock runs ahead of the real one (the dev clock; 0 in production). The
   * OS fires on real time, so every trigger moves back by this much.
   */
  offsetMs: number;
  /** The weekly re-engagement setting. */
  reengage: boolean;
  /** Name the goal in the question. Off by default, to keep it off the lock screen. */
  showGoal: boolean;
}

/** "Did you stick to your goal today?", or with the goal's wording when the user turned that on. */
export function checkInQuestion(goal: string, when: 'today' | 'yesterday', showGoal: boolean): string {
  return showGoal ? `Did you stick to “${goal}” ${when}?` : `Did you stick to your goal ${when}?`;
}

function nudgeFor(state: GoalState, day: DayKey): { title: string; body: string } {
  const week = Math.floor(diffDays(day, state.firstDay) / 7);
  return NUDGES[((week % NUDGES.length) + NUDGES.length) % NUDGES.length] ?? NUDGES[0]!;
}

function contentFor(state: GoalState, r: PlannedReminder, showGoal: boolean): ReminderContent {
  const data: ReminderData = { goalId: state.goalId, day: r.day, kind: r.kind };
  if (r.kind === 'reengage') return { ...nudgeFor(state, r.day), data };
  const when = isWindowToday(windowFor(state, r.day), r.at) ? 'today' : 'yesterday';
  return {
    title: r.kind === 'checkin' ? CHECKIN_TITLE : MORNING_TITLE,
    body: checkInQuestion(state.goal, when, showGoal),
    data,
    categoryIdentifier: CHECKIN_CATEGORY_ID,
    sound: 'default',
  };
}

/**
 * Every notification that should be pending at `now`, earliest first. Catches the goal up
 * first, so a state that hasn't been resolved lately still plans from the right day.
 */
export function reminderRequests(input: ReminderInput): ReminderRequest[] {
  const state = resolve(input.goal, input.now, input.tz).state;
  return planReminders(state, input.now, { reengage: input.reengage })
    .slice(0, MAX_SCHEDULED)
    .map((r) => ({
      identifier: `${r.kind}-${r.day}`,
      content: contentFor(state, r, input.showGoal),
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date: new Date(r.at.getTime() - input.offsetMs),
        channelId: CHECKIN_CHANNEL_ID,
      },
    }));
}

/**
 * Development only: a check-in for the open window (or the next one) that arrives in
 * TEST_DELAY_SECONDS of real time. Its buttons answer for real.
 */
export function testCheckInRequest(
  input: Pick<ReminderInput, 'goal' | 'now' | 'tz' | 'showGoal'>,
  identifier: string,
): NotificationRequestInput & { content: ReminderContent; trigger: TimeIntervalTriggerInput } {
  const state = resolve(input.goal, input.now, input.tz).state;
  const w = nextWindow(state);
  const upcoming = w.opensAt.getTime() > input.now.getTime();
  const when = upcoming || isWindowToday(w, input.now) ? 'today' : 'yesterday';
  const data: ReminderData = { goalId: state.goalId, day: w.day, kind: 'checkin', test: true };
  return {
    identifier,
    content: {
      title: CHECKIN_TITLE,
      body: checkInQuestion(state.goal, when, input.showGoal),
      data,
      categoryIdentifier: CHECKIN_CATEGORY_ID,
      sound: 'default',
    },
    trigger: {
      type: SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: TEST_DELAY_SECONDS,
      channelId: CHECKIN_CHANNEL_ID,
    },
  };
}
