// Cancel-and-rebuild against a fake notifications module: order, the dev test survivor,
// permission, skipping, serializing, errors, stale delivered notifications, and the store
// changes that trigger a sync.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NotificationRequestInput } from 'expo-notifications';

import { type GoalState } from '@/engine';
import { at, DAY0, DENVER, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { fakeAppState, flush, harness, ready, withGoal } from '@/store/__tests__/harness';

import { reminderRequests } from '../schedule';
import type { ReminderData } from '../shared';
import {
  createReminderSync,
  startReminderSync,
  staleDelivered,
  syncInputFrom,
  type ReminderApi,
  type ReminderSync,
  type SyncInput,
} from '../sync';

beforeEach(async () => {
  await AsyncStorage.clear();
});

type Shown = { request: { identifier: string; content: { data?: unknown } } };

/** An in-memory stand-in for expo-notifications that logs every call. */
function fakeNotifications() {
  const scheduled = new Map<string, NotificationRequestInput>();
  let presented: Shown[] = [];
  const log: string[] = [];
  const failing = new Set<string>();
  let gate: Promise<void> | null = null;
  let release = () => {};
  const api: ReminderApi = {
    getAllScheduledNotificationsAsync: async () => {
      log.push('list');
      return [...scheduled.values()].map((r) => ({ identifier: r.identifier!, content: { data: r.content.data } }));
    },
    cancelScheduledNotificationAsync: async (id) => {
      log.push(`cancel ${id}`);
      scheduled.delete(id);
    },
    scheduleNotificationAsync: async (r) => {
      if (gate) await gate;
      log.push(`schedule ${r.identifier}`);
      if (failing.has(r.identifier!)) throw new Error(`can't schedule ${r.identifier}`);
      scheduled.set(r.identifier!, r);
      return r.identifier!;
    },
    getPresentedNotificationsAsync: async () => {
      log.push('presented');
      return presented;
    },
    dismissNotificationAsync: async (id) => {
      log.push(`dismiss ${id}`);
      presented = presented.filter((n) => n.request.identifier !== id);
    },
  };
  return {
    api,
    scheduled,
    log,
    failing,
    ids: () => [...scheduled.keys()],
    presentedIds: () => presented.map((n) => n.request.identifier),
    present: (identifier: string, data: unknown) => presented.push({ request: { identifier, content: { data } } }),
    schedule: (identifier: string, data: ReminderData) =>
      scheduled.set(identifier, { identifier, content: { data }, trigger: null }),
    /** Hold every schedule call until the returned function is called. */
    hold: () => {
      gate = new Promise((resolve) => (release = resolve));
      return () => {
        gate = null;
        release();
      };
    },
  };
}

function input(goal: GoalState | null, now = at(DAY0, '12:00'), patch: Partial<SyncInput> = {}): SyncInput {
  return { goal, now, tz: DENVER, offsetMs: 0, reengage: true, showGoal: false, ...patch };
}

function setup(state: { input: SyncInput; allowed?: boolean }) {
  const fake = fakeNotifications();
  const errors: unknown[] = [];
  const prepare = jest.fn(async () => {});
  const sync = createReminderSync({
    api: fake.api,
    read: () => state.input,
    allowed: async () => state.allowed ?? true,
    prepare,
    onError: (e) => errors.push(e),
  });
  return { fake, sync, errors, prepare };
}

const expectedIds = (i: SyncInput) => reminderRequests({ ...i, goal: i.goal! }).map((r) => r.identifier);

describe('createReminderSync', () => {
  it('cancels what was scheduled, then schedules the plan', async () => {
    const state = { input: input(newGoal()) };
    const { fake, sync, prepare } = setup(state);
    fake.schedule('checkin-2026-10-01', { goalId: 'g1', day: '2026-10-01', kind: 'checkin' });

    await sync.sync({ force: true });
    const ids = expectedIds(state.input);
    expect(ids).toHaveLength(37); // 14 windows × 2, the next day's check-in before the reset, 8 nudges
    expect(fake.log).toEqual(['list', 'cancel checkin-2026-10-01', ...ids.map((id) => `schedule ${id}`), 'presented']);
    expect(fake.ids()).toEqual(ids);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('leaves a dev test notification alone', async () => {
    const { fake, sync } = setup({ input: input(newGoal()) });
    fake.schedule('test-1', { goalId: 'g1', day: DAY0, kind: 'checkin', test: true });
    await sync.sync({ force: true });
    expect(fake.ids()).toContain('test-1');
    expect(fake.log).not.toContain('cancel test-1');
  });

  it('after erase, cancels everything and clears what was delivered', async () => {
    const state: { input: SyncInput } = { input: input(newGoal()) };
    const { fake, sync } = setup(state);
    await sync.sync({ force: true });
    fake.present('checkin-2026-10-13', { goalId: 'g1', day: DAY0, kind: 'checkin' });

    state.input = input(null);
    await sync.sync();
    expect(fake.ids()).toEqual([]);
    expect(fake.presentedIds()).toEqual([]);
  });

  it('schedules nothing without permission, and catches up once it is granted', async () => {
    const state = { input: input(newGoal()), allowed: false };
    const { fake, sync } = setup(state);
    await sync.sync({ force: true });
    expect(fake.ids()).toEqual([]);

    state.allowed = true;
    await sync.sync(); // not forced: the signature changed
    expect(fake.ids()).toHaveLength(37);
  });

  it('skips the work when nothing changed, unless forced', async () => {
    const state = { input: input(newGoal()) };
    const { fake, sync } = setup(state);
    const reports: number[] = [];
    sync.subscribe((r) => reports.push(r.scheduled));

    await sync.sync({ force: true });
    const calls = fake.log.length;
    await sync.sync();
    expect(fake.log).toHaveLength(calls);

    await sync.sync({ force: true });
    expect(fake.log.length).toBeGreaterThan(calls);
    expect(reports).toEqual([37, 37]);
  });

  it('reschedules when the answer, the wording setting or the dev clock changes', async () => {
    const state = { input: input(newGoal(), at(DAY0, '21:00')) };
    const { fake, sync } = setup(state);
    await sync.sync({ force: true });
    expect(fake.ids()).toContain('morning-2026-10-13');

    state.input = input(yesDays(newGoal(), DAY0, 1), at(DAY0, '21:00'));
    await sync.sync();
    expect(fake.ids()).not.toContain('morning-2026-10-13');
    expect(fake.ids()[0]).toBe('checkin-2026-10-14');

    state.input = { ...state.input, showGoal: true };
    await sync.sync();
    expect(fake.scheduled.get('checkin-2026-10-14')?.content.body).toBe('Did you stick to “Stop drinking” today?');

    state.input = { ...state.input, offsetMs: 60_000 };
    await sync.sync();
    expect((fake.scheduled.get('checkin-2026-10-14')?.trigger as { date: Date }).date).toEqual(
      new Date(at('2026-10-14', '20:00').getTime() - 60_000),
    );
  });

  it('runs one sync at a time, folding every request made meanwhile into one more', async () => {
    const { fake, sync } = setup({ input: input(newGoal()) });
    const release = fake.hold();
    const first = sync.sync({ force: true });
    await flush(); // the first sync is now waiting on its first schedule call
    const more = [sync.sync(), sync.sync({ force: true }), sync.sync(), sync.sync(), sync.sync()];
    release();
    await Promise.all([first, ...more]);

    const lists = fake.log.flatMap((l, i) => (l === 'list' ? [i] : []));
    const presented = fake.log.flatMap((l, i) => (l === 'presented' ? [i] : []));
    expect(lists).toHaveLength(2);
    expect(presented).toHaveLength(2);
    expect(lists[1]).toBeGreaterThan(presented[0]!); // the second began after the first ended
    expect(fake.ids()).toHaveLength(37);
  });

  it('keeps scheduling when one request fails', async () => {
    const { fake, sync, errors } = setup({ input: input(newGoal()) });
    fake.failing.add('checkin-2026-10-14');
    await sync.sync({ force: true });
    expect(errors).toHaveLength(1);
    expect(fake.ids()).toHaveLength(36);
    expect(fake.ids()).toContain('checkin-2026-10-15');
  });

  it('retries the one-time setup after it fails', async () => {
    const { fake, sync, errors, prepare } = setup({ input: input(newGoal()) });
    prepare.mockImplementationOnce(async () => {
      throw new Error('no channel');
    });
    await sync.sync({ force: true });
    expect(errors).toHaveLength(1);
    expect(fake.ids()).toEqual([]);
    await sync.sync();
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(fake.ids()).toHaveLength(37);
  });
});

describe('staleDelivered', () => {
  it("clears what's no longer open, and keeps the open check-in", () => {
    const goal = yesDays(newGoal(), DAY0, 1); // 10-13 answered
    const now = at('2026-10-15', '08:00'); // 10-14 open until midnight tonight
    const shown = [
      { identifier: 'checkin-2026-10-13', data: { goalId: 'g1', day: DAY0, kind: 'checkin' } }, // answered
      { identifier: 'checkin-2026-10-14', data: { goalId: 'g1', day: '2026-10-14', kind: 'checkin' } }, // open
      { identifier: 'morning-2026-10-14', data: { goalId: 'g1', day: '2026-10-14', kind: 'morning' } }, // open
      { identifier: 'reengage-2026-10-14', data: { goalId: 'g1', day: '2026-10-14', kind: 'reengage' } },
      { identifier: 'checkin-old', data: { goalId: 'g0', day: '2026-10-14', kind: 'checkin' } }, // erased goal
      { identifier: 'other', data: {} }, // not ours
    ];
    expect(staleDelivered(shown, input(goal, now))).toEqual(['checkin-2026-10-13', 'reengage-2026-10-14', 'checkin-old']);
    // Once 10-14 closes unanswered, its notifications go too.
    expect(staleDelivered(shown, input(goal, at('2026-10-16', '00:30')))).toEqual([
      'checkin-2026-10-13',
      'checkin-2026-10-14',
      'morning-2026-10-14',
      'reengage-2026-10-14',
      'checkin-old',
    ]);
    expect(staleDelivered(shown, input(null))).toEqual(shown.slice(0, 5).map((s) => s.identifier));
  });

  it("keeps today's check-in while yesterday is still open, and clears yesterday's once answered", () => {
    const goal = yesDays(newGoal(), DAY0, 1); // 10-13 answered; 10-14 open until midnight ending 10-15
    const shown = [
      { identifier: 'checkin-2026-10-14', data: { goalId: 'g1', day: '2026-10-14', kind: 'checkin' } },
      { identifier: 'morning-2026-10-14', data: { goalId: 'g1', day: '2026-10-14', kind: 'morning' } },
      { identifier: 'checkin-2026-10-15', data: { goalId: 'g1', day: '2026-10-15', kind: 'checkin' } },
    ];
    const evening = at('2026-10-15', '21:00');
    expect(staleDelivered(shown, input(goal, evening))).toEqual([]);
    const answered = yesDays(goal, '2026-10-14', 1);
    expect(staleDelivered(shown, input(answered, evening))).toEqual(['checkin-2026-10-14', 'morning-2026-10-14']);
  });
});

describe('startReminderSync', () => {
  function recorder(): ReminderSync & { calls: boolean[] } {
    const calls: boolean[] = [];
    return {
      calls,
      sync: async (o = {}) => {
        calls.push(o.force ?? false);
      },
      subscribe: () => () => {},
    };
  }

  it('syncs after storage is read, on foreground, and when the goal or reminder settings change', async () => {
    const h = harness();
    const rec = recorder();
    const app = fakeAppState();
    const stop = startReminderSync(h.store, rec, app);
    expect(rec.calls).toEqual([]);
    await ready(h.store);
    expect(rec.calls).toEqual([true]); // forced after hydration

    const s = () => h.store.getState();
    const changes: [string, () => void][] = [
      ['setup', () => s().setupGoal({ goal: 'Stop drinking', checkInTime: '20:00', morningTime: '09:00' })],
      ['wording', () => s().setGoalText('Stay sober')],
      ['check-in time', () => s().setCheckInTime('21:00')],
      ['morning time', () => s().setMorningTime('08:00')],
      ['weekly nudge', () => s().setPref('reengage', false)],
      ['goal in reminders', () => s().setPref('goalInReminders', true)],
      ['dev clock', () => s().advanceDevClock(60_000)],
      ['check-in', () => (h.setTime(DAY0, '21:30'), s().answer('yes'))],
      ['not today', () => (h.setTime('2026-10-14', '21:30'), s().answer('not-today'))],
      ['undo', () => s().undoNotToday()],
      ['erase', () => s().erase()],
    ];
    for (const [name, change] of changes) {
      const before = rec.calls.length;
      change();
      expect([name, rec.calls.length]).toEqual([name, before + 1]);
      expect(rec.calls.at(-1)).toBe(false);
    }

    const before = rec.calls.length;
    s().setPref('sound', false);
    s().setPref('haptics', false);
    expect(rec.calls).toHaveLength(before);

    app.emit('background');
    expect(rec.calls).toHaveLength(before);
    app.emit('active');
    expect(rec.calls.slice(before)).toEqual([true]);

    stop();
    app.emit('active');
    expect(rec.calls).toHaveLength(before + 1);
    expect(app.count()).toBe(0);
  });

  it('plans from the store: its goal, clock, time zone, dev offset and settings', async () => {
    const h = await withGoal(newGoal(), { dev: true });
    h.store.getState().advanceDevClock(60_000);
    h.store.getState().setPref('reengage', false);
    expect(syncInputFrom(h.store.getState()).showGoal).toBe(false); // private by default
    h.store.getState().setPref('goalInReminders', true);
    expect(syncInputFrom(h.store.getState())).toEqual({
      goal: h.store.getState().goal,
      now: new Date(h.clock.t + 60_000),
      tz: DENVER,
      offsetMs: 60_000,
      reengage: false,
      showGoal: true,
    });
  });
});
