// Haptics, gated by the player's setting. Failures (no haptic engine) are ignored.
import * as Haptics from 'expo-haptics';

import { appStore } from '@/store';

const on = () => appStore.getState().prefs.haptics;
const quiet = (p: Promise<void>) => p.catch(() => {});

export const feedback = {
  /** A wheel tick or a toggle. */
  tick: () => on() && quiet(Haptics.selectionAsync()),
  /** An ordinary button. */
  press: () => on() && quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** A Yes, or a round finished. */
  success: () => on() && quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A Not today: acknowledged, gently. */
  soft: () => on() && quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)),
};
