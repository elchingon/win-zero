// Answering from a notification against a real store and a fake notifications module: cold
// start, warm taps, the morning reminder, Home's banners, dedupe, plain taps and old goals.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DEFAULT_ACTION_IDENTIFIER } from 'expo-notifications';

import type { GoalState } from '@/engine';
import { DAY0, newGoal, yesDays } from '@/engine/__tests__/fixtures';
import { flush, harness, ready, withGoal } from '@/store/__tests__/harness';

import { decideResponse, startResponses, type ResponseApi, type ResponseLike } from '../responses';
import { shouldGoHome } from '../route';
import { ACTION_NOT_TODAY, ACTION_YES, type ReminderData } from '../shared';

beforeEach(async () => {
  await AsyncStorage.clear();
});

/** A response to one of our notifications. */
function response(action: string, data: Partial<ReminderData> & { day: string }, id?: string, date = 1): ResponseLike {
  const payload = { goalId: 'g1', kind: 'checkin', ...data };
  return {
    actionIdentifier: action,
    notification: { date, request: { identifier: id ?? `${payload.kind}-${payload.day}`, content: { data: payload } } },
  };
}

/** A stand-in for expo-notifications' response API. */
function fakeResponses() {
  let last: ResponseLike | null = null;
  const listeners = new Set<(r: ResponseLike) => void>();
  const dismissed: string[] = [];
  let cleared = 0;
  const api: ResponseApi = {
    getLastNotificationResponse: () => last,
    addNotificationResponseReceivedListener: (fn) => {
      listeners.add(fn);
      return { remove: () => listeners.delete(fn) };
    },
    clearLastNotificationResponse: () => {
      last = null;
      cleared++;
    },
    dismissNotificationAsync: async (id) => {
      dismissed.push(id);
    },
  };
  return {
    api,
    dismissed,
    cleared: () => cleared,
    listeners: () => listeners.size,
    /** The response that launched the app. */
    launchWith: (r: ResponseLike) => (last = r),
    /** A tap while the app is running (or before JS is ready, on Android). */
    tap: (r: ResponseLike) => {
      last = r;
      listeners.forEach((fn) => fn(r));
    },
  };
}

/** A hydrated store holding `goal` at a time and date, listening for responses. */
async function running(goal: GoalState, day: string, time: `${number}:${number}`) {
  const h = await withGoal(goal);
  h.setTime(day, time);
  const fake = fakeResponses();
  const nav = { toHome: jest.fn() };
  const stop = startResponses(h.store, fake.api, nav);
  return { ...h, fake, nav, stop, s: () => h.store.getState() };
}

describe('decideResponse', () => {
  it('answers only from the buttons on a check-in or morning reminder for this goal', () => {
    const day = '2026-10-15';
    expect(decideResponse(response(ACTION_YES, { day }), 'g1')).toEqual({ kind: 'answer', answer: 'yes', day });
    expect(decideResponse(response(ACTION_NOT_TODAY, { day, kind: 'morning' }), 'g1')).toEqual({
      kind: 'answer',
      answer: 'not-today',
      day,
    });
    expect(decideResponse(response(ACTION_YES, { day, test: true }), 'g1')).toMatchObject({ kind: 'answer' });

    expect(decideResponse(response(DEFAULT_ACTION_IDENTIFIER, { day }), 'g1')).toEqual({ kind: 'open' });
    expect(decideResponse(response(ACTION_YES, { day, kind: 'reengage' }), 'g1')).toEqual({ kind: 'open' });
    expect(decideResponse(response(ACTION_YES, { day, goalId: 'g0' }), 'g1')).toEqual({ kind: 'open' });
    expect(decideResponse(response('snooze', { day }), 'g1')).toEqual({ kind: 'open' });
    const junk: ResponseLike = { actionIdentifier: ACTION_YES, notification: { date: 1, request: { identifier: 'x', content: {} } } };
    expect(decideResponse(junk, 'g1')).toEqual({ kind: 'open' });
  });
});

describe('shouldGoHome', () => {
  it("brings Home forward, but not over the notice or before there's a navigator", () => {
    expect(shouldGoHome('/settings')).toBe(true);
    expect(shouldGoHome('/play')).toBe(true);
    expect(shouldGoHome('/setup')).toBe(true);
    expect(shouldGoHome('/')).toBe(false);
    expect(shouldGoHome('/notice')).toBe(false);
    expect(shouldGoHome(null)).toBe(false);
  });
});

describe('startResponses', () => {
  it('cold start: a Yes that launched the app is answered once storage is read, before Home shows', async () => {
    const first = harness();
    await ready(first.store);
    first.store.setState({ goal: yesDays(newGoal(), DAY0, 2) }); // through 10-14, saved
    await flush();

    const h = harness();
    h.setTime('2026-10-15', '20:02');
    const fake = fakeResponses();
    fake.launchWith(response(ACTION_YES, { day: '2026-10-15' }));
    fake.tap(response(ACTION_YES, { day: '2026-10-15' })); // Android reports it to the listener too
    const nav = { toHome: jest.fn() };
    startResponses(h.store, fake.api, nav);
    expect(h.store.getState().goal).toBeNull(); // not read yet: nothing happens

    await ready(h.store);
    const s = h.store.getState();
    expect(s.goal).toMatchObject({ streak: 3, lastSettledDay: '2026-10-15' });
    expect(s.round).toMatchObject({ day: '2026-10-15', n: 3, played: false });
    expect(s.route).toBe('/play'); // Home opens the round as it mounts
    expect(s.rejection).toBeNull(); // answered once, not "already answered"
    expect(fake.dismissed).toEqual(['checkin-2026-10-15']);
    expect(fake.cleared()).toBe(1);
    expect(nav.toHome).toHaveBeenCalledTimes(1);
  });

  it('a Not today while the app runs opens its notice', async () => {
    const r = await running(yesDays(newGoal(), DAY0, 2), '2026-10-15', '21:00');
    r.fake.tap(response(ACTION_NOT_TODAY, { day: '2026-10-15' }));
    expect(r.s().goal).toMatchObject({ streak: 1, lastSettledDay: '2026-10-15' });
    expect(r.s().notice).toMatchObject({ kind: 'slipping', cause: 'answer', lost: 1 });
    expect(r.s().route).toBe('/notice');
    expect(r.nav.toHome).toHaveBeenCalledTimes(1);
  });

  it("answers yesterday's window from the morning reminder", async () => {
    const r = await running(yesDays(newGoal(), DAY0, 2), '2026-10-16', '09:05');
    r.fake.tap(response(ACTION_YES, { day: '2026-10-15', kind: 'morning' }));
    expect(r.s().round).toMatchObject({ day: '2026-10-15', n: 3 });
    expect(r.s().route).toBe('/play');
    expect(r.fake.dismissed).toEqual(['morning-2026-10-15']);
  });

  it("shows Home's banner when the check-in has closed, was answered, or hasn't opened", async () => {
    const r = await running(yesDays(newGoal(), DAY0, 2), '2026-10-16', '20:30'); // 10-15 closed
    r.fake.tap(response(ACTION_YES, { day: '2026-10-15' }));
    expect(r.s()).toMatchObject({ rejection: 'expired', route: null, round: null });
    expect(r.s().goal?.lastSettledDay).toBe('2026-10-15'); // caught up all the same

    r.fake.tap(response(ACTION_YES, { day: '2026-10-14' }));
    expect(r.s().rejection).toBe('already-answered');

    r.fake.tap(response(ACTION_NOT_TODAY, { day: '2026-10-17' }, 'test-1'));
    expect(r.s().rejection).toBe('not-open');
    expect(r.nav.toHome).toHaveBeenCalledTimes(3);
  });

  it('handles each tap once, however often it is reported', async () => {
    const r = await running(yesDays(newGoal(), DAY0, 2), '2026-10-15', '21:00');
    const yes = response(ACTION_YES, { day: '2026-10-15' });
    r.fake.tap(yes);
    r.fake.tap(yes);
    expect(r.s().rejection).toBeNull(); // the repeat wasn't answered as "already answered"
    expect(r.nav.toHome).toHaveBeenCalledTimes(1);

    // The other button on the same notification, still showing on Android, is a new tap.
    r.fake.tap(response(ACTION_NOT_TODAY, { day: '2026-10-15' }));
    expect(r.s().rejection).toBe('already-answered');
    expect(r.s().goal?.streak).toBe(3);
  });

  it('opens Home without answering for a plain tap, a nudge, or an old goal', async () => {
    const goal = yesDays(newGoal(), DAY0, 2);
    const r = await running(goal, '2026-10-15', '21:00');
    r.fake.tap(response(DEFAULT_ACTION_IDENTIFIER, { day: '2026-10-15' }));
    r.fake.tap(response(DEFAULT_ACTION_IDENTIFIER, { day: '2026-10-15', kind: 'reengage' }));
    r.fake.tap(response(ACTION_YES, { day: '2026-10-15', goalId: 'g0' }, 'old'));
    expect(r.s().goal).toBe(goal);
    expect(r.s()).toMatchObject({ route: null, rejection: null });
    expect(r.nav.toHome).toHaveBeenCalledTimes(3);
  });

  it('after erase, leaves Setup alone', async () => {
    const r = await running(yesDays(newGoal(), DAY0, 2), '2026-10-15', '21:00');
    r.s().erase();
    r.fake.tap(response(ACTION_YES, { day: '2026-10-15' }));
    expect(r.s().goal).toBeNull();
    expect(r.nav.toHome).not.toHaveBeenCalled();
    expect(r.fake.dismissed).toEqual(['checkin-2026-10-15']);
  });

  it('stops listening on cleanup', async () => {
    const r = await running(yesDays(newGoal(), DAY0, 2), '2026-10-15', '21:00');
    expect(r.fake.listeners()).toBe(1);
    r.stop();
    expect(r.fake.listeners()).toBe(0);
  });
});
