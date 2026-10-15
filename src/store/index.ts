// The app's store, wired to the device. Tests build their own with createAppStore.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';

import { createAppStore, type AppState } from './createAppStore';
import { deviceTimeZone } from './device';
import { makeId } from './id';

export const appStore = createAppStore({
  storage: AsyncStorage,
  now: () => new Date(),
  timeZone: deviceTimeZone,
  makeId,
  dev: __DEV__,
});

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

export type { AppState, AppStore, EditResult, SetupResult } from './createAppStore';
export { startLifecycle, whenHydrated } from './lifecycle';
export type { AnswerRoute, Notice, Prefs, RoundRecord } from './types';
