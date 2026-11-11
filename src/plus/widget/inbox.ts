// Where a widget's Yes waits for the app (SPEC 9). +native-intent reads links before React and the
// store are ready, so it leaves the Yes here; once storage has been read it's answered as the
// notification's Yes is, and Home brings the round forward. A widget can be a moment behind: a day
// already answered isn't news, so its banner is dropped.
import type { AppStore } from '@/store/createAppStore';
import { whenHydrated } from '@/store/lifecycle';

import type { WidgetYes } from './link';

let pending: WidgetYes[] = [];
const listeners = new Set<() => void>();

export function deliverWidgetYes(yes: WidgetYes): void {
  pending = [...pending, yes];
  listeners.forEach((listener) => listener());
}

export interface WidgetNavigation {
  /** Bring Home forward, unless now isn't the moment (notifications/route.ts). */
  toHome(): void;
}

/** Answer each widget Yes once storage has been read: the one that launched the app, then each one after. Returns a cleanup. */
export function startWidgetLinks(store: AppStore, nav: WidgetNavigation): () => void {
  const waits: (() => void)[] = [];
  const take = () => {
    const yeses = pending;
    pending = [];
    for (const { goalId, day } of yeses) {
      waits.push(
        whenHydrated(store, () => {
          const s = store.getState();
          if (s.goals.some((slot) => slot.goal.goalId === goalId)) {
            const r = s.answer(goalId, 'yes', day, 'notification');
            if (r && !r.ok && r.reason === 'already-answered') store.setState({ rejection: null });
          }
          nav.toHome();
        }),
      );
    }
  };
  take();
  listeners.add(take);
  return () => {
    listeners.delete(take);
    waits.forEach((stop) => stop());
  };
}
