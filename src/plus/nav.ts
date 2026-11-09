// Leaving a Win Zero Plus screen pushed from Settings (SPEC 9).
import { router } from 'expo-router';

import { appStore } from '@/store';

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

/**
 * Away from a goal just archived or deleted: back where it was opened from, or with no goal left,
 * Home, which starts Setup. Settings has nothing to show without a goal.
 */
export function leaveGoal() {
  if (appStore.getState().goals.length > 0) leave();
  else router.dismissTo('/');
}
