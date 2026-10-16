// Catch up on closed windows when the app launches and whenever it returns to the foreground.
// The foreground signal is passed in (React Native's AppState in the app, page visibility on the
// website), so this stays free of platform imports.
import type { AppStore } from './createAppStore';

/** 'active' when the app is in front, as React Native's AppState reports it. */
export type AppStateStatus = string;

export type AppStateLike = {
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
export function startLifecycle(store: AppStore, appState: AppStateLike): () => void {
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
