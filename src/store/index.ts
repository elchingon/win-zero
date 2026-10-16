// The app's store, wired to the device. Tests build their own with createAppStore.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';

import { createAppStore, type AppState, type StoreDeps } from './createAppStore';
import { deviceTimeZone } from './device';
import { makeId } from './id';

export const appStore = createAppStore({
  storage: AsyncStorage,
  now: () => new Date(),
  timeZone: deviceTimeZone,
  makeId,
  dev: __DEV__,
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
export type { AppState, AppStore, EditResult, SetupResult } from './createAppStore';
export { startLifecycle, whenHydrated } from './lifecycle';
export type { AnswerRoute, AnswerSource, Notice, PendingNotice, Prefs, RoundRecord } from './types';
