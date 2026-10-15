// Keeping the phone's scheduled notifications in step with the goal (SPEC 2: "on every check-in
// or app open, cancel and reschedule"). A sync cancels what's scheduled and schedules the
// engine's plan again. Syncs run one at a time; requests made during one fold into one more.
import type { NotificationRequestInput } from 'expo-notifications';
import { AppState } from 'react-native';

import { pendingWindow, resolve, type GoalState } from '@/engine';
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

/** What a sync plans from: the goal (none after erase) and the settings that shape reminders. */
export type SyncInput = Omit<ReminderInput, 'goal'> & { goal: GoalState | null };

export function syncInputFrom(s: StoreState): SyncInput {
  return {
    goal: s.goal,
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
 * Delivered notifications to clear: check-ins and morning reminders for days that are no longer
 * open (answered or closed), nudges once the app is open, and anything from an erased goal.
 */
export function staleDelivered(presented: { identifier: string; data: unknown }[], input: SyncInput): string[] {
  const goal = input.goal ? resolve(input.goal, input.now, input.tz).state : null;
  const openDay = goal ? (pendingWindow(goal, input.now)?.day ?? null) : null;
  return presented
    .filter((p) => {
      const data = readReminderData(p.data);
      if (!data) return false;
      if (!goal || data.goalId !== goal.goalId) return true;
      return data.kind === 'reengage' || data.day !== openDay;
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
      const goal = input.goal;
      const allowed = goal ? await deps.allowed() : false;
      const requests = goal && allowed ? reminderRequests({ ...input, goal }) : [];
      const signature = JSON.stringify([goal?.goalId ?? null, requests]);
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
 * get added and the OS's list is rebuilt), and whenever the goal or a reminder setting changes:
 * a check-in, a missed day settling, goal wording, times, a time zone change, erase.
 */
export function startReminderSync(store: AppStore, reminders: ReminderSync, appState: AppStateLike = AppState): () => void {
  const stopWaiting = whenHydrated(store, () => void reminders.sync({ force: true }));
  const unsubscribe = store.subscribe((s, prev) => {
    if (!s.hydrated) return;
    const changed =
      s.goal !== prev.goal ||
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
