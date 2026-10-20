// Win Zero Plus: an earned theme's icon stays on the home screen only while it's earned (SPEC 9).
// The arsenal's reach never goes down in play, so this only acts when Erase all data (or the debug
// Jump to day) lowers it: an icon that's no longer earned goes back to the app's own, and an
// included theme's icon stays. Nothing switches otherwise, so iOS never shows its notice for nothing.
// Plus-only: require it behind the literal process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'.
import { keptIcon } from '@/engine/icons';
import { arsenalBestOf, type AppStore } from '@/store';

import { currentIcon, setIcon } from './appIcon';

/** Watches the store from now on; returns the unsubscribe. */
export function startIconGuard(store: AppStore): () => void {
  let reach = arsenalBestOf(store.getState());
  return store.subscribe((s) => {
    const next = arsenalBestOf(s);
    const dropped = s.hydrated && next < reach;
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
