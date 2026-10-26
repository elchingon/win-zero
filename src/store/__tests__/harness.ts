// A store on a fake clock and time zone, backed by the AsyncStorage mock. Shared by the store
// and notification tests.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { expect } from '@jest/globals';
import type { AppStateStatus } from 'react-native';

import type { ClockTime, DayKey, GoalState } from '@/engine';
import * as seedRun from '@/dev/seedRun';
import { at, DAY0, DENVER } from '@/engine/__tests__/fixtures';

import { createAppStore, type AppStore } from '../createAppStore';
import type { Limits } from '../limits';
import { DEFAULT_PERSISTED } from '../migrate';
import { primaryGoal } from '../select';
import type { GoalSlot, Notice, RoundRecord } from '../types';

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

export function harness(opts: { dev?: boolean; limits?: Limits } = {}) {
  const clock = { t: at(DAY0, '12:00').getTime() };
  const zone = { tz: DENVER };
  let ids = 0;
  const store = createAppStore({
    storage: AsyncStorage,
    now: () => new Date(clock.t),
    timeZone: () => zone.tz,
    makeId: () => `goal-${++ids}`,
    dev: opts.dev ?? true,
    limits: opts.limits,
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

/** State with `goal` as the only goal, for setState. */
export function oneGoal(
  goal: GoalState,
  round: RoundRecord | null = null,
  seenThrough: DayKey | null = null,
): { goals: GoalSlot[] } {
  return { goals: [{ goal, round, seenThrough }] };
}

/** Replace the first goal's state, keeping the rest of its slot. */
export function putGoal(store: AppStore, goal: GoalState): void {
  const [first, ...rest] = store.getState().goals;
  store.setState({ goals: [{ round: null, seenThrough: null, ...first, goal }, ...rest] });
}

/** The first goal's id: the goal the free app shows. */
export function gid(store: AppStore): string {
  const goal = primaryGoal(store.getState());
  if (!goal) throw new Error('No goal');
  return goal.goalId;
}

/** The first goal's answer notice, waiting to be shown, or null. */
export function noticeOf(store: AppStore): Notice | null {
  const goal = primaryGoal(store.getState());
  return goal ? (store.getState().notices[goal.goalId] ?? null) : null;
}

/** A hydrated store holding `goal`, and nothing left over from an earlier test's storage. */
export async function withGoal(goal: GoalState, opts: { dev?: boolean; limits?: Limits } = {}) {
  const h = harness(opts);
  await ready(h.store);
  h.store.setState({ ...DEFAULT_PERSISTED, ...oneGoal(goal) });
  return h;
}
