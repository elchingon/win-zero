// Leaving a Win Zero Plus screen pushed from Settings (SPEC 9).
import { router } from 'expo-router';

/**
 * Back to the screen this one was opened from. Opened cold from a link, there's none: go Home and
 * open Settings over it, so Settings' own Done still has somewhere to go.
 */
export function leave() {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/');
  router.push('/settings');
}
