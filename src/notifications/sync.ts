// Keeping the phone's scheduled notifications in step with the goals (SPEC 2: "on every check-in
// or app open, cancel and reschedule"). A sync cancels what's scheduled and schedules the
// engine's plan again. Syncs run one at a time; requests made during one fold into one more.
import type { NotificationRequestInput } from 'expo-notifications';
import { AppState } from 'react-native';

import { firstUnsettledDay, resolve } from '@/engine';
import type { AppStore, AppState as StoreState } from '@/store/createAppStore';
import { whenHydrated, type AppStateLike } from '@/store/lifecycle';

import { reminderRequests, type ReminderInput } from './schedule';
import { readReminderData } from './shared';

/** The parts of expo-notifications a sync uses, so tests can pass a fake. */
export interface ReminderApi {
  getAllScheduledNotificationsAsync(): Promise<{ identifier: string; content: { data?: unknown } }[]>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
  scheduleNotificationAsync(request: NotificationRequestInput): Promise<string>;
  getPresentedNotificationsAsync(): Promise<{ request: { identifier: string; content: { data?: unknown } } }[]>;
  dismissNotificationAsync(identifier: string): Promise<void>;
}

/** What a sync plans from: the goals (none after erase) and the settings that shape reminders. */
export type SyncInput = ReminderInput;

export function syncInputFrom(s: StoreState): SyncInput {
  return {
    goals: s.goals.map((slot) => slot.goal),
    now: s.now(),
    tz: s.timeZone(),
    offsetMs: s.clockOffsetMs(),
    reengage: s.prefs.reengage,
    showGoal: s.prefs.goalInReminders,
  };
}

export interface SyncDeps {
  api: ReminderApi;
  read: () => SyncInput;
  /** Notification permission. Without it nothing is scheduled (iOS can refuse the request). */
  allowed: () => Promise<boolean>;
  /** One-time setup before the first sync, such as the Android channel. Retried after a failure. */
  prepare?: () => Promise<void>;
  onError?: (error: unknown) => void;
}

export interface SyncReport {
  /** Requests handed to the OS in the latest sync. */
  scheduled: number;
}

export interface ReminderSync {
  /**
   * Bring the scheduled notifications up to date. Skips the work when nothing changed since
   * the last sync, unless `force` (launch, return to the foreground, permission granted).
   */
  sync: (options?: { force?: boolean }) => Promise<void>;
  /** Called after each sync that changed what's scheduled. Returns an unsubscribe. */
  subscribe: (listener: (report: SyncReport) => void) => () => void;
}

/**
 * Delivered notifications to clear: check-ins and morning reminders for days their goal has
 * settled (answered or closed), nudges once the app is open, and anything from a goal that's gone
 * (archived or erased). Today's check-in stays while yesterday is still open: both days are still
 * to answer.
 */
export function staleDelivered(presented: { identifier: string; data: unknown }[], input: SyncInput): string[] {
  const firstOpen = new Map(
    input.goals.map((goal) => [goal.goalId, firstUnsettledDay(resolve(goal, input.now, input.tz).state)]),
  );
  return presented
    .filter((p) => {
      const data = readReminderData(p.data);
      if (!data) return false;
      const open = firstOpen.get(data.goalId);
      if (open === undefined) return true;
      return data.kind === 'reengage' || data.day < open;
    })
    .map((p) => p.identifier);
}

export function createReminderSync(deps: SyncDeps): ReminderSync {
  const { api } = deps;
  const listeners = new Set<(report: SyncReport) => void>();
  let prepared = false;
  /** What the last completed sync scheduled; null forces the next one. */
  let lastSignature: string | null = null;
  let running: Promise<void> | null = null;
  let queued: { force: boolean } | null = null;

  async function runOnce(force: boolean): Promise<void> {
    try {
      if (!prepared && deps.prepare) await deps.prepare();
      prepared = true;
      const input = deps.read();
      const some = input.goals.length > 0;
      const allowed = some ? await deps.allowed() : false;
      const requests = some && allowed ? reminderRequests(input) : [];
      const signature = JSON.stringify([input.goals.map((g) => g.goalId), requests]);
      if (!force && signature === lastSignature) return;
      lastSignature = null; // until this sync finishes

      // Cancel everything scheduled except a dev test notification still on its way.
      for (const n of await api.getAllScheduledNotificationsAsync()) {
        if (!readReminderData(n.content.data)?.test) await api.cancelScheduledNotificationAsync(n.identifier);
      }
      let scheduled = 0;
      for (const request of requests) {
        try {
          await api.scheduleNotificationAsync(request);
          scheduled++;
        } catch (error) {
          deps.onError?.(error); // one bad request (say, a time that just passed) shouldn't stop the rest
        }
      }
      const presented = (await api.getPresentedNotificationsAsync()).map((n) => ({
        identifier: n.request.identifier,
        data: n.request.content.data,
      }));
      for (const id of staleDelivered(presented, input)) await api.dismissNotificationAsync(id);

      lastSignature = signature;
      listeners.forEach((l) => l({ scheduled }));
    } catch (error) {
      deps.onError?.(error);
    }
  }

  async function drain(force: boolean): Promise<void> {
    try {
      for (;;) {
        await runOnce(force);
        if (!queued) return;
        force = queued.force;
        queued = null;
      }
    } finally {
      running = null;
    }
  }

  return {
    sync: (options = {}) => {
      const force = options.force ?? false;
      if (running) {
        queued = { force: force || (queued?.force ?? false) };
        return running;
      }
      running = drain(force);
      return running;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Sync after storage is read and on every return to the foreground (both forced, so new nudges
 * get added and the OS's list is rebuilt), and whenever a goal or a reminder setting changes:
 * a check-in, a missed day settling, goal wording, times, days, a time zone change, a goal added
 * or archived, erase.
 */
export function startReminderSync(store: AppStore, reminders: ReminderSync, appState: AppStateLike = AppState): () => void {
  const stopWaiting = whenHydrated(store, () => void reminders.sync({ force: true }));
  const unsubscribe = store.subscribe((s, prev) => {
    if (!s.hydrated) return;
    const changed =
      s.goals !== prev.goals ||
      s.prefs.reengage !== prev.prefs.reengage ||
      s.prefs.goalInReminders !== prev.prefs.goalInReminders ||
      s.devClockOffsetMs !== prev.devClockOffsetMs;
    if (changed) void reminders.sync();
  });
  const sub = appState.addEventListener('change', (state) => {
    if (state === 'active' && store.getState().hydrated) void reminders.sync({ force: true });
  });
  return () => {
    stopWaiting();
    unsubscribe();
    sub.remove();
  };
}
