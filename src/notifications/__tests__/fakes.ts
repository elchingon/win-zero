// Stand-ins for expo-notifications' response API, shared by the response and Home routing tests.
import type { ResponseApi, ResponseLike } from '../responses';
import type { ReminderData } from '../shared';

/** A response to one of our notifications. */
export function response(action: string, data: Partial<ReminderData> & { day: string }, id?: string, date = 1): ResponseLike {
  const payload = { goalId: 'g1', kind: 'checkin', ...data };
  return {
    actionIdentifier: action,
    notification: { date, request: { identifier: id ?? `${payload.kind}-${payload.day}`, content: { data: payload } } },
  };
}

/** A stand-in for expo-notifications' response API. */
export function fakeResponses() {
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
