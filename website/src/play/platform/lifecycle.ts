// The page's version of "the app came to the foreground": the tab becoming visible again, or the
// page coming back from the browser's back/forward cache. Feeds the shared startLifecycle.
import type { AppStateLike } from '@/store/lifecycle';

export const pageVisibility: AppStateLike = {
  addEventListener: (_type, listener) => {
    const onVisibility = () => listener(document.visibilityState === 'visible' ? 'active' : 'background');
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) listener('active');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onShow);
    return {
      remove: () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pageshow', onShow);
      },
    };
  },
};
