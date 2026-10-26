// What Home opens while it has focus: the screen an answer left (the round for Yes, the notice
// for Not today), or else news of missed days. At most one screen per visit: router.push is
// queued, so Home keeps hearing store updates for a few frames after asking to leave, and a
// second push would land on top of the first. Whatever is left waits for the next visit.
import type { AppStore, AppState } from '@/store/createAppStore';
import type { PendingRoute } from '@/store/types';

/** Every goal's latest settled day, so a day settling anywhere shows up as a change. */
const settled = (s: AppState) => s.goals.map((slot) => slot.goal.lastSettledDay).join();

/** Start on focus; the returned cleanup runs on blur. */
export function startHomeRouting(store: AppStore, push: (route: PendingRoute) => void): () => void {
  let left = false;
  const go = (route: PendingRoute) => {
    if (left) return;
    left = true;
    push(route);
  };

  /** Open the screen the latest answer left. False when there's none to open. */
  const openRoute = () => {
    const route = store.getState().takeRoute();
    // Its notice may already have been shown (by a Notice screen opened for missed days).
    if (!route || (route.path === '/notice' && !store.getState().nextNotice(route.goalId))) return false;
    go(route);
    return true;
  };

  /** Catch up on closed windows, then show any missed-day news. */
  const showNews = () => {
    store.getState().refresh();
    const news = store.getState().nextNotice();
    if (news) go({ path: '/notice', goalId: news.goalId });
    else store.getState().markQuietMisses();
  };

  // An answer comes first, so missed-day news waits until its round or notice is over.
  if (!openRoute()) showNews();
  const unsubscribe = store.subscribe((s, prev) => {
    if (left) return; // leave the route for the next visit
    if (s.route) openRoute();
    else if (s.goals !== prev.goals && settled(s) !== settled(prev)) showNews();
  });
  return () => {
    unsubscribe();
    store.getState().clearRejection(); // a turned-down answer's banner lasts one visit
  };
}
