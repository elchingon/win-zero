// Win Zero Plus: an earned theme's icon stays on the home screen only while it's earned (SPEC 9).
// The arsenal's reach and the comeback mark never go down in play, so this only acts when Erase all
// data (or the debug Jump to day) lowers them: an icon that's no longer earned goes back to the
// app's own, and an included theme's icon stays. Nothing switches otherwise, so iOS never shows its
// notice for nothing.
// Plus-only: require it behind the literal process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'.
import type { ThemeReach } from '@/engine';
import { keptIcon } from '@/engine/icons';
import { arsenalBestOf, type AppState, type AppStore } from '@/store';

import { currentIcon, setIcon } from './appIcon';

const reachOf = (s: AppState): ThemeReach => ({ best: arsenalBestOf(s), cameBack: s.cameBack });

/** Watches the store from now on; returns the unsubscribe. */
export function startIconGuard(store: AppStore): () => void {
  let reach = reachOf(store.getState());
  return store.subscribe((s) => {
    const next = reachOf(s);
    const dropped = s.hydrated && (next.best < reach.best || (reach.cameBack && !next.cameBack));
    reach = next;
    if (!dropped) return;
    const opts = { iconsEnabled: s.limits.iconsEnabled };
    void currentIcon()
      .then((icon) => {
        const kept = keptIcon(icon, next, opts);
        return kept === icon ? icon : setIcon(kept);
      })
      .catch(() => {});
  });
}
