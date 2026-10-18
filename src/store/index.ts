// The app's store, wired to the device. Tests build their own with createAppStore.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';

import { LIMITS } from '@/variant';

import { createAppStore, type AppState, type StoreDeps } from './createAppStore';
import { deviceTimeZone } from './device';
import { makeId } from './id';

export const appStore = createAppStore({
  storage: AsyncStorage,
  now: () => new Date(),
  timeZone: deviceTimeZone,
  makeId,
  dev: __DEV__,
  limits: LIMITS,
  // Metro folds __DEV__ to false in production and drops the require.
  devTools: __DEV__
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('@/dev/seedRun') as StoreDeps['devTools'])
    : undefined,
});

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

export { REMINDER_CARD_HIDE_MS, UNDO_MS, UNDO_MS_SCREEN_READER } from './createAppStore';
export type { AddGoalResult, AppState, AppStore, EditResult } from './createAppStore';
export { startLifecycle, whenHydrated } from './lifecycle';
export type { Limits } from './limits';
export * from './select';
export type {
  AnswerRoute,
  AnswerSource,
  ArchivedGoal,
  BonusRound,
  CreditRound,
  GoalSlot,
  Notice,
  PendingNotice,
  PendingRoute,
  Prefs,
  Rejection,
  RoundRecord,
} from './types';
