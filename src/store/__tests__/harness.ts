// A store on a fake clock and time zone, backed by the AsyncStorage mock. Shared by the store
// and notification tests.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { expect } from '@jest/globals';
import type { AppStateStatus } from 'react-native';

import type { ClockTime, DayKey, GoalState } from '@/engine';
import * as seedRun from '@/dev/seedRun';
import { at, DAY0, DENVER } from '@/engine/__tests__/fixtures';

import { createAppStore, type AppStore } from '../createAppStore';
import { DEFAULT_PERSISTED } from '../migrate';

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export function harness(opts: { dev?: boolean } = {}) {
  const clock = { t: at(DAY0, '12:00').getTime() };
  const zone = { tz: DENVER };
  let ids = 0;
  const store = createAppStore({
    storage: AsyncStorage,
    now: () => new Date(clock.t),
    timeZone: () => zone.tz,
    makeId: () => `goal-${++ids}`,
    dev: opts.dev ?? true,
    devTools: seedRun,
  });
  const setTime = (day: DayKey, time: ClockTime) => {
    clock.t = at(day, time).getTime();
  };
  return { store, clock, zone, setTime };
}

export async function ready(store: AppStore) {
  for (let i = 0; i < 50 && !store.getState().hydrated; i++) await flush();
  expect(store.getState().hydrated).toBe(true);
}

/** A fake AppState that records its listener, so a test can bring the app to the foreground. */
export function fakeAppState() {
  const listeners: ((s: AppStateStatus) => void)[] = [];
  return {
    addEventListener: (_type: 'change', fn: (s: AppStateStatus) => void) => {
      listeners.push(fn);
      return { remove: () => listeners.splice(listeners.indexOf(fn), 1) };
    },
    emit: (s: AppStateStatus) => listeners.forEach((fn) => fn(s)),
    count: () => listeners.length,
  };
}

/** A hydrated store holding `goal`, and nothing left over from an earlier test's storage. */
export async function withGoal(goal: GoalState, opts: { dev?: boolean } = {}) {
  const h = harness(opts);
  await ready(h.store);
  h.store.setState({ ...DEFAULT_PERSISTED, goal });
  return h;
}
