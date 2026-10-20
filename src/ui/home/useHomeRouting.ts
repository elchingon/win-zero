// While Home has focus: open the screen an answer left (the round for Yes, the notice for Not
// today), from the card here or a notification's buttons; otherwise, on focus and whenever days
// settle while Home is showing (the app comes back to the foreground, a window closes), catch up
// and show any Slipping / Reset / Shielded news once. One screen per visit (see routing.ts).
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { appStore } from '@/store';

import { startHomeRouting } from './routing';

export function useHomeRouting() {
  useFocusEffect(
    useCallback(
      () => startHomeRouting(appStore, (route) => router.push({ pathname: route.path, params: { goal: route.goalId } })),
      [],
    ),
  );
}
