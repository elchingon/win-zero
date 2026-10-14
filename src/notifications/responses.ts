// Tapping a notification or one of its buttons (SPEC 1–2). Yes answers through the store and
// opens the round; Not today answers and opens its notice; a plain tap opens Home. The store
// records where the answer leads (or why it was turned down) and Home opens it.
import type { Answer, DayKey } from '@/engine';
import type { AppStore } from '@/store/createAppStore';
import { whenHydrated } from '@/store/lifecycle';

import { ACTION_NOT_TODAY, ACTION_YES, readReminderData } from './shared';

/** The parts of a NotificationResponse this reads. */
export interface ResponseLike {
  actionIdentifier: string;
  notification: { date: number; request: { identifier: string; content: { data?: unknown } } };
}

/** The parts of expo-notifications response handling uses, so tests can pass a fake. */
export interface ResponseApi {
  getLastNotificationResponse(): ResponseLike | null;
  addNotificationResponseReceivedListener(listener: (response: ResponseLike) => void): { remove(): void };
  clearLastNotificationResponse(): void;
  dismissNotificationAsync(identifier: string): Promise<void>;
}

export interface ResponseNavigation {
  /** Bring Home forward, unless now isn't the moment (see route.ts). */
  toHome(): void;
}

export type ResponseDecision = { kind: 'answer'; answer: Answer; day: DayKey } | { kind: 'open' };

/**
 * What a response asks for. Only the Yes / Not today buttons on a check-in or morning reminder
 * for the current goal answer. A plain tap (DEFAULT_ACTION_IDENTIFIER), a nudge, an old goal's
 * notification or anything unknown just opens Home.
 */
export function decideResponse(response: ResponseLike, goalId: string): ResponseDecision {
  const data = readReminderData(response.notification.request.content.data);
  if (!data || data.goalId !== goalId || data.kind === 'reengage') return { kind: 'open' };
  if (response.actionIdentifier === ACTION_YES) return { kind: 'answer', answer: 'yes', day: data.day };
  if (response.actionIdentifier === ACTION_NOT_TODAY) return { kind: 'answer', answer: 'not-today', day: data.day };
  return { kind: 'open' };
}

/** One tap, however many times it's reported. */
function responseKey(r: ResponseLike): string {
  return `${r.notification.request.identifier}|${r.actionIdentifier}|${r.notification.date}`;
}

/**
 * Handle responses once storage has been read: the one that launched the app (a cold start),
 * then each one while it runs. Android reports a launch response to both, so each is handled
 * once. Returns a cleanup.
 */
export function startResponses(store: AppStore, api: ResponseApi, nav: ResponseNavigation): () => void {
  const handled = new Set<string>();
  const waiting: ResponseLike[] = [];
  let ready = false;

  const handle = (response: ResponseLike) => {
    const key = responseKey(response);
    if (handled.has(key)) return;
    handled.add(key);
    api.clearLastNotificationResponse();
    // Android leaves a notification up after one of its buttons is pressed.
    api.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});

    const goal = store.getState().goal;
    if (!goal) return; // erased: Setup is showing, and stays
    const decision = decideResponse(response, goal.goalId);
    if (decision.kind === 'answer') store.getState().answer(decision.answer, decision.day);
    nav.toHome();
  };

  const sub = api.addNotificationResponseReceivedListener((response) => {
    if (ready) handle(response);
    else waiting.push(response);
  });
  const stopWaiting = whenHydrated(store, () => {
    ready = true;
    let launch: ResponseLike | null = null;
    try {
      launch = api.getLastNotificationResponse();
    } catch {
      // not available on this platform
    }
    if (launch) handle(launch);
    waiting.splice(0).forEach(handle);
  });

  return () => {
    stopWaiting();
    sub.remove();
  };
}
