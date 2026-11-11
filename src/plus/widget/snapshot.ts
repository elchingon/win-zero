// What Win Zero Plus's widgets show (SPEC 9), worked out ahead: the goals' moments for the next
// TIMELINE_HORIZON_DAYS (engine/timeline.ts), merged into frames, each with every goal's words and
// links. The widgets pick the frame for the time and lay it out; every word is written here, so
// it's tested with the rest of the copy. Pure: the clock, the time zone and the settings come in.
import { dayKeyAt, diffDays, goalTimeline, TIMELINE_HORIZON_DAYS, type GoalMoment, type TimeZone } from '@/engine';
import { formatDayShort, formatDayWithWeekday, formatInstantTime } from '@/lib/format';
import { widgetLabel } from '@/notifications/labels';
import type { GoalSlot } from '@/store';

import { WIDGET_COPY } from '../copy';
import { homeLink, playLink, yesLink } from './link';

/** What a widget does with a goal: ask for its check-in, offer its round, say when it's next, or say it's on a break. */
export type WidgetState = 'open' | 'ready' | 'waiting' | 'break';

export interface WidgetGoal {
  id: string;
  /** As its reminders name it: its wording only with Goal in reminders on. */
  label: string;
  state: WidgetState;
  /** Its streak. */
  zeros: number;
  headline: string;
  detail: string;
  /** The lock screen's one line. */
  inline: string;
  /** What VoiceOver and TalkBack say. */
  a11y: string;
  /** Where a tap goes: the round, or Home. */
  url: string;
  /** While its check-in is open: the Yes. */
  yes?: string;
}

export interface WidgetFrame {
  /** When it starts, in epoch ms on the real clock. */
  at: number;
  /** The goals, the ones to answer first: open check-ins (earliest first), rounds ready, the rest, then breaks. */
  goals: WidgetGoal[];
}

export interface WidgetSnapshot {
  v: 1;
  writtenAt: number;
  frames: WidgetFrame[];
  /** With no goal (after Erase, or before Setup). */
  empty: { headline: string; detail: string; url: string };
}

/** The most frames a snapshot keeps. */
export const WIDGET_MAX_FRAMES = 64;

export interface SnapshotInput {
  slots: readonly GoalSlot[];
  /** The app's clock (the debug clock in development), and how far it runs ahead of the real one. */
  now: Date;
  offsetMs: number;
  tz: TimeZone;
  h24: boolean;
  /** Goal in reminders: whether a goal's own words may show. */
  showGoal: boolean;
  scheme: string;
}

const ORDER: Readonly<Record<WidgetState, number>> = { open: 0, ready: 1, waiting: 2, break: 3 };

/** 'Today 8:00 PM', 'Tomorrow 8:00 PM', 'Tue 8:00 PM' or 'Nov 3 8:00 PM', seen from `at`. */
function when(instant: Date, at: Date, tz: TimeZone, h24: boolean): string {
  const day = dayKeyAt(instant, tz);
  const diff = diffDays(day, dayKeyAt(at, tz));
  const name = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff > 1 && diff < 7 ? formatDayWithWeekday(day).slice(0, 3) : formatDayShort(day);
  return `${name} ${formatInstantTime(instant, tz, h24)}`;
}

/** One goal at moment `m`, seen at `at`. */
function goalAt(slot: GoalSlot, place: number, count: number, m: GoalMoment, at: Date, input: SnapshotInput): WidgetGoal {
  const { goal, round } = slot;
  const label = widgetLabel(goal, place, count, input.showGoal);
  const zeros = WIDGET_COPY.zeros(m.streak);
  const base = { id: goal.goalId, label, zeros: m.streak, url: homeLink(input.scheme) };
  if (m.open) {
    return {
      ...base,
      state: 'open',
      headline: WIDGET_COPY.open.headline,
      detail: WIDGET_COPY.open.detail(m.streak + 1),
      inline: WIDGET_COPY.open.inline(zeros),
      a11y: WIDGET_COPY.open.a11y(label, zeros),
      yes: yesLink(input.scheme, goal.goalId, m.open.day),
    };
  }
  // A round waits until the goal's next day settles, as the store keeps it.
  if (round && !round.played && m.settledThrough === round.day) {
    return {
      ...base,
      state: 'ready',
      headline: WIDGET_COPY.ready.headline(round.n),
      detail: WIDGET_COPY.ready.detail,
      inline: WIDGET_COPY.ready.headline(round.n),
      a11y: WIDGET_COPY.ready.a11y(label, round.n),
      url: playLink(input.scheme, goal.goalId),
    };
  }
  const next = when(m.next.opensAt, at, input.tz, input.h24);
  if (m.onBreak) {
    const until = formatDayWithWeekday(m.onBreak.break.to);
    return {
      ...base,
      state: 'break',
      headline: WIDGET_COPY.break.headline,
      detail: WIDGET_COPY.break.detail(until),
      inline: WIDGET_COPY.break.inline(formatDayShort(m.onBreak.break.to)),
      a11y: WIDGET_COPY.break.a11y(label, until, next),
    };
  }
  return {
    ...base,
    state: 'waiting',
    headline: WIDGET_COPY.waiting.headline,
    detail: next,
    inline: WIDGET_COPY.waiting.inline(next),
    a11y: WIDGET_COPY.waiting.a11y(label, zeros, next),
  };
}

/** The widgets' frames for the next TIMELINE_HORIZON_DAYS, from the goals as they stand at `now`. */
export function widgetSnapshot(input: SnapshotInput): WidgetSnapshot {
  const { slots, now, offsetMs, tz } = input;
  const until = new Date(now.getTime() + TIMELINE_HORIZON_DAYS * 86_400_000);
  const timelines = slots.map((slot) => goalTimeline(slot.goal, now, tz, until));
  const times = [...new Set(timelines.flatMap((ms) => ms.map((m) => m.at.getTime())))].sort((a, b) => a - b);
  const frames: WidgetFrame[] = [];
  let last = '';
  for (const t of times) {
    const at = new Date(t);
    const goals = slots
      .flatMap((slot, i) => {
        // The goal's latest moment by `t`: every timeline starts at `now`.
        let m: GoalMoment | undefined;
        for (const x of timelines[i] ?? []) if (x.at.getTime() <= t) m = x;
        return m ? [{ g: goalAt(slot, i, slots.length, m, at, input), i, opens: m.open?.opensAt.getTime() ?? 0 }] : [];
      })
      .sort((a, b) => ORDER[a.g.state] - ORDER[b.g.state] || a.opens - b.opens || a.i - b.i)
      .map(({ g }) => g);
    const key = JSON.stringify(goals);
    if (key === last) continue;
    last = key;
    frames.push({ at: t - offsetMs, goals });
    if (frames.length >= WIDGET_MAX_FRAMES) break;
  }
  return {
    v: 1,
    writtenAt: now.getTime() - offsetMs,
    frames,
    empty: { headline: WIDGET_COPY.empty.headline, detail: WIDGET_COPY.empty.detail, url: homeLink(input.scheme) },
  };
}
