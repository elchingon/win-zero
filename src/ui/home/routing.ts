// What Home opens while it has focus: the screen an answer left (the round for Yes, the notice
// for Not today), or else news of missed days. At most one screen per visit: router.push is
// queued, so Home keeps hearing store updates for a few frames after asking to leave, and a
// second push would land on top of the first. Whatever is left waits for the next visit.
import type { AppStore } from '@/store/createAppStore';
import type { AnswerRoute } from '@/store/types';

/** Start on focus; the returned cleanup runs on blur. */
export function startHomeRouting(store: AppStore, push: (path: AnswerRoute) => void): () => void {
  let left = false;
  const go = (path: AnswerRoute) => {
    if (left) return;
    left = true;
    push(path);
  };

  /** Open the screen the latest answer left. False when there's none to open. */
  const openRoute = () => {
    const route = store.getState().takeRoute();
    // Its notice may already have been shown (by a Notice screen opened for missed days).
    if (!route || (route === '/notice' && !store.getState().nextNotice())) return false;
    go(route);
    return true;
  };

  /** Catch up on closed windows, then show any missed-day news. */
  const showNews = () => {
    store.getState().refresh();
    if (store.getState().nextNotice()) go('/notice');
    else store.getState().markQuietMisses();
  };

  // An answer comes first, so missed-day news waits until its round or notice is over.
  if (!openRoute()) showNews();
  const unsubscribe = store.subscribe((s, prev) => {
    if (left) return; // leave the route for the next visit
    if (s.route) openRoute();
    else if (s.goal?.lastSettledDay !== prev.goal?.lastSettledDay) showNews();
  });
  return () => {
    unsubscribe();
    store.getState().clearRejection(); // a turned-down answer's banner lasts one visit
  };
}
