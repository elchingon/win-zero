// Catch up on closed windows when the app launches and whenever it returns to the foreground.
import { AppState, type AppStateStatus } from 'react-native';

import type { AppStore } from './createAppStore';

type AppStateLike = {
  addEventListener: (type: 'change', listener: (state: AppStateStatus) => void) => { remove: () => void };
};

/** Calls `fn` once storage has been read: now, or as soon as it has. */
export function whenHydrated(store: AppStore, fn: () => void): () => void {
  if (store.getState().hydrated) {
    fn();
    return () => {};
  }
  const unsubscribe = store.subscribe((s) => {
    if (!s.hydrated) return;
    unsubscribe();
    fn();
  });
  return unsubscribe;
}

/** Resolve after hydration and on every return to the foreground. Returns a cleanup. */
export function startLifecycle(store: AppStore, appState: AppStateLike = AppState): () => void {
  const refresh = () => {
    if (store.getState().hydrated) store.getState().refresh();
  };
  const stopWaiting = whenHydrated(store, refresh);
  const sub = appState.addEventListener('change', (state) => {
    if (state === 'active') refresh();
  });
  return () => {
    stopWaiting();
    sub.remove();
  };
}
