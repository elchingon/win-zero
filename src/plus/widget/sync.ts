// Keeping the widgets current (SPEC 9): a fresh snapshot once storage has been read, whenever a goal
// or Goal in reminders changes (an answer, a day settling, an edit, a break, Erase), and on every
// return to the foreground, since the clock has moved on. Changes close together make one, and one
// that comes out the same as the last isn't written again. Erase writes the empty one, so no goal
// is left on a widget.
import { getCalendars } from 'expo-localization';
import { AppState } from 'react-native';

import type { AppStore } from '@/store/createAppStore';
import { whenHydrated } from '@/store/lifecycle';
import { APP_GROUP, SCHEME } from '@/variant';

import { widgetSnapshot } from './snapshot';

/** Changes this close together make one snapshot. */
export const WIDGET_SETTLE_MS = 300;

/** Where a snapshot goes: the widgets module, or a stand-in in tests. */
export interface WidgetWriter {
  setSnapshotAsync(json: string, group: string): Promise<void>;
}

export interface AppStateLike {
  addEventListener(type: 'change', listener: (state: string) => void): { remove(): void };
}

const deviceH24 = () => getCalendars()[0]?.uses24hourClock ?? false;

/** Keep the widgets current while the app runs; nothing without a widgets module. Returns a cleanup. */
export function startWidgetSync(
  store: AppStore,
  writer: WidgetWriter | null,
  appState: AppStateLike = AppState,
  uses24h: () => boolean = deviceH24,
): () => void {
  if (!writer) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = '';
  const write = () => {
    timer = null;
    const s = store.getState();
    const snapshot = widgetSnapshot({
      slots: s.goals,
      now: s.now(),
      offsetMs: s.clockOffsetMs(),
      tz: s.timeZone(),
      h24: uses24h(),
      showGoal: s.prefs.goalInReminders,
      scheme: SCHEME,
    });
    // The frames and words decide; when it was written doesn't.
    const key = JSON.stringify([snapshot.frames, snapshot.empty]);
    if (key === last) return;
    last = key;
    writer.setSnapshotAsync(JSON.stringify(snapshot), APP_GROUP).catch(() => {
      last = '';
    });
  };
  const soon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, WIDGET_SETTLE_MS);
  };
  const stopWaiting = whenHydrated(store, soon);
  const unsubscribe = store.subscribe((s, prev) => {
    if (!s.hydrated) return;
    if (s.goals !== prev.goals || s.prefs.goalInReminders !== prev.prefs.goalInReminders || s.devClockOffsetMs !== prev.devClockOffsetMs) soon();
  });
  const sub = appState.addEventListener('change', (state) => {
    if (state === 'active' && store.getState().hydrated) soon();
  });
  return () => {
    stopWaiting();
    unsubscribe();
    sub.remove();
    if (timer) clearTimeout(timer);
  };
}
