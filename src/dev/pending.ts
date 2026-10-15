// Development builds only: a one-line summary of the scheduled notifications for the debug tools.
import { addDays, type DayKey } from '@/engine';
import { readReminderData, type ReminderData } from '@/notifications/shared';

export interface PendingSummary {
  count: number;
  /** The next to arrive, e.g. "check-in 10-14" or "morning 10-14" (sent the morning after). */
  next: string | null;
  /** Dev test check-ins still on their way. */
  tests: number;
}

const LABELS: Record<ReminderData['kind'], string> = { checkin: 'check-in', morning: 'morning', reengage: 'nudge' };

/** When it fires, as a sortable key: a morning reminder for D goes out on D+1, before D+1's check-in. */
function orderKey(d: ReminderData): [DayKey, number] {
  return d.kind === 'morning' ? [addDays(d.day, 1), 0] : [d.day, 1];
}

/**
 * Ordered by the payload rather than the OS's trigger, whose shape differs by platform. A test
 * check-in arrives within seconds, so it's next whenever there is one.
 */
export function summarizePending(scheduled: { content: { data?: unknown } }[]): PendingSummary {
  const ours = scheduled.map((n) => readReminderData(n.content.data)).filter((d): d is ReminderData => d !== null);
  const tests = ours.filter((d) => d.test).length;
  const reminders = ours
    .filter((d) => !d.test)
    .sort((a, b) => {
      const [ka, kb] = [orderKey(a), orderKey(b)];
      return ka[0] < kb[0] ? -1 : ka[0] > kb[0] ? 1 : ka[1] - kb[1];
    });
  const first = reminders[0];
  const next = tests > 0 ? 'test check-in' : first ? `${LABELS[first.kind]} ${first.day.slice(5)}` : null;
  return { count: scheduled.length, next, tests };
}
