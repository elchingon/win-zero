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
  isEveryDay,
  isWindowToday,
  nextWindow,
  planAllReminders,
  resolve,
  windowFor,
  type DayKey,
  type GoalReminder,
  type GoalState,
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
/** The check-in's title for a goal on chosen days (SPEC 9), which isn't daily. */
const DAYS_CHECKIN_TITLE = 'Check-in time';
const MORNING_TITLE = 'Still time to check in';
/** Today's check-in while yesterday's is still open. Home asks about yesterday first. */
export const BOTH_OPEN_BODY = "Yesterday's check-in is still open, and today's is ready. Tap to answer.";

/** BOTH_OPEN_BODY for one of several goals, named as its reminders name it. */
export function bothOpenBody(label: string): string {
  return `Yesterday's check-in for ${label} is still open, and today's is ready. Tap to answer.`;
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];

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
  /** Every goal, in the order they're shown; none after erase. */
  goals: GoalState[];
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

/**
 * How a reminder names a goal: its wording when the user turned that on, and otherwise "your goal",
 * which keeps it off the lock screen. With more than one goal (SPEC 9), its lock-screen name, or
 * its place among them: "your second goal".
 */
export function goalLabel(goal: GoalState, place: number, count: number, showGoal: boolean): string {
  if (showGoal) return `“${goal.goal}”`;
  if (count <= 1) return 'your goal';
  if (goal.alias) return `“${goal.alias}”`;
  const ordinal = ORDINALS[place];
  return ordinal ? `your ${ordinal} goal` : 'your goal';
}

/** A check-in's title: "Daily check-in", unless the goal checks in on chosen days only. */
export function checkInTitle(goal: GoalState): string {
  return isEveryDay(goal) ? CHECKIN_TITLE : DAYS_CHECKIN_TITLE;
}

/** "Did you stick to your goal today?", with the goal as `label` names it. */
export function checkInQuestion(label: string, when: 'today' | 'yesterday'): string {
  return `Did you stick to ${label} ${when}?`;
}

function nudgeFor(state: GoalState, day: DayKey): { title: string; body: string } {
  const week = Math.floor(diffDays(day, state.firstDay) / 7);
  return NUDGES[((week % NUDGES.length) + NUDGES.length) % NUDGES.length] ?? NUDGES[0]!;
}

function contentFor(state: GoalState, r: GoalReminder, label: string, several: boolean): ReminderContent {
  const data: ReminderData = { goalId: state.goalId, day: r.day, kind: r.kind };
  if (r.kind === 'reengage') return { ...nudgeFor(state, r.day), data };
  // No buttons: a Yes here couldn't say which day it means. A tap opens Home, which asks about
  // yesterday first. Answering yesterday reschedules this as a plain check-in.
  if (r.earlier) {
    return { title: checkInTitle(state), body: several ? bothOpenBody(label) : BOTH_OPEN_BODY, data, sound: 'default' };
  }
  const when = isWindowToday(windowFor(state, r.day), r.at) ? 'today' : 'yesterday';
  return {
    title: r.kind === 'checkin' ? checkInTitle(state) : MORNING_TITLE,
    body: checkInQuestion(label, when),
    data,
    categoryIdentifier: CHECKIN_CATEGORY_ID,
    sound: 'default',
  };
}

/**
 * Every notification that should be pending at `now`, earliest first: each goal's, within the
 * iOS limit (planAllReminders). Catches the goals up first, so a state that hasn't been resolved
 * lately still plans from the right day.
 */
export function reminderRequests(input: ReminderInput): ReminderRequest[] {
  const goals = input.goals.map((goal) => resolve(goal, input.now, input.tz).state);
  const labels = new Map(goals.map((g, i) => [g.goalId, goalLabel(g, i, goals.length, input.showGoal)]));
  const byId = new Map(goals.map((g) => [g.goalId, g]));
  return planAllReminders(goals, input.now, { reengage: input.reengage, budget: MAX_SCHEDULED }).map((r) => ({
    identifier: `${r.goalId}:${r.kind}-${r.day}`,
    content: contentFor(byId.get(r.goalId)!, r, labels.get(r.goalId)!, goals.length > 1),
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
  input: Pick<ReminderInput, 'now' | 'tz' | 'showGoal'> & { goal: GoalState },
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
      title: checkInTitle(state),
      body: checkInQuestion(goalLabel(state, 0, 1, input.showGoal), when),
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
