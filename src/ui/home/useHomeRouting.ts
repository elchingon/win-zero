// While Home has focus: open the screen an answer left (the round for Yes, the notice for Not
// today), from the card here or a notification's buttons; otherwise, on focus and whenever days
// settle while Home is showing (the app comes back to the foreground, a window closes), catch up
// and show any Slipping / Reset / Shielded news once. One screen per visit (see routing.ts). A Yes
// tapped here holds its round back while the celebration covers the screen.
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { appStore } from '@/store';
import type { PendingRoute } from '@/store/types';
import { yesCelebration } from '@/ui/celebrate';

import { startHomeRouting } from './routing';

function open(route: PendingRoute) {
  const push = () => router.push({ pathname: route.path, params: { goal: route.goalId } });
  const hold = route.path === '/play' ? yesCelebration.begin() : 0;
  if (hold > 0) setTimeout(push, hold);
  else push();
}

export function useHomeRouting() {
  useFocusEffect(useCallback(() => startHomeRouting(appStore, open), []));
}
