// The app's store, wired to the browser. In demo mode it runs on demo mode's own copy of the
// progress, with the debug clock and Jump to day turned on (see platform/mode.ts).
import { useStore } from 'zustand';

import * as seedRun from '@/dev/seedRun';
import { createAppStore, type AppState, type AppStore } from '@/store/createAppStore';
import { makeId } from '@/store/id';
import { STORE_KEY } from '@/store/types';

import { browserTimeZone } from './platform/device';
import { DEMO_PREFIX, isDemo } from './platform/mode';
import { browserStorage } from './platform/storage';

export const demoMode = isDemo();

const storage = browserStorage(demoMode ? DEMO_PREFIX : '');

/** False when this browser won't keep progress (a private window, or site data blocked). */
export const storagePersistent = storage.persistent;

/** The storage key this tab's store reads and writes, for noticing other tabs' changes. */
export const storeKey = (demoMode ? DEMO_PREFIX : '') + STORE_KEY;

export const appStore: AppStore = createAppStore({
  storage,
  now: () => new Date(),
  timeZone: browserTimeZone,
  makeId,
  dev: demoMode,
  devTools: demoMode ? seedRun : undefined,
});

export function useApp<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}
