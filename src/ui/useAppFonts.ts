// The app's fonts, loaded once at launch. Bold text (Settings › Accessibility, or iOS Bold Text)
// loads heavier files under the same family names, so loading waits for saved settings, and a
// change shows from the next launch: styles name their fonts as the app starts.
import { loadAsync } from 'expo-font';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { appStore, useApp } from '@/store';
import { fontAssetsFor } from '@/theme/fonts';

let launchedBold: boolean | null = null;

/** Whether this launch has the bold fonts; null until they've loaded. */
export function boldAtLaunch(): boolean | null {
  return launchedBold;
}

/** [loaded, error], as expo-font's useFonts gives them. */
export function useAppFonts(): [boolean, Error | null] {
  const hydrated = useApp((s) => s.hydrated);
  const [state, setState] = useState<[boolean, Error | null]>([false, null]);
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    (async () => {
      // false on Android, which has no such setting for apps to read.
      const system = await AccessibilityInfo.isBoldTextEnabled().catch(() => false);
      const bold = appStore.getState().prefs.boldText || system;
      try {
        await loadAsync(fontAssetsFor(bold));
        launchedBold = bold;
        if (alive) setState([true, null]);
      } catch (e) {
        if (alive) setState([false, e instanceof Error ? e : new Error(String(e))]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrated]);
  return state;
}
