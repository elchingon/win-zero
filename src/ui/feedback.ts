// Haptics, gated by the player's setting. Failures (no haptic engine) are ignored.
//
// Android files a short vibration that names no usage, as expo-haptics plays them, under touch
// feedback, and drops it while the phone's Touch feedback setting is off. So on Android the moments
// (a Yes, the round's kills, bombs and boom, the encouragement's tap) play through modules/haptics
// as media, under the phone's Media vibration setting, with waveforms of their own. Plain taps and
// wheel ticks are the system's own clicks, which follow Touch feedback as in every other app.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { appStore } from '@/store';

import AppHaptics, { type AppHapticsModule } from '../../modules/haptics';

/** A waveform: step lengths in ms, and each step's strength from 0 (off) to 255 (full). */
export interface Wave {
  timings: readonly number[];
  amplitudes: readonly number[];
}

/**
 * The last zero's explosion, at twice the strength and length it had (expo-haptics' Heavy: one
 * 60 ms step at 70 on Android, one tap on iPhone). Android: a full-strength hit and a tail at
 * twice the old strength, each twice the old length. iPhone: Heavy is its strongest single tap,
 * so it plays two.
 */
export const BOOM_HIT_MS = 120;
export const BOOM_TAIL_MS = 120;
export const BOOM_TAIL_STRENGTH = 140;
export const BOOM_IOS_HITS = 2;
export const BOOM_IOS_GAP_MS = 70;

type Moment = 'yes' | 'success' | 'soft' | 'cheer' | 'kill' | 'bomb' | 'boom';

/** Android's waveform for each moment, tuned on a Pixel 6 Pro. */
export const ANDROID_WAVES: Record<Moment, Wave> = {
  yes: { timings: [0, 28], amplitudes: [0, 170] },
  success: { timings: [0, 40, 90, 50], amplitudes: [0, 150, 0, 190] },
  soft: { timings: [0, 30], amplitudes: [0, 90] },
  cheer: { timings: [0, 25], amplitudes: [0, 140] },
  kill: { timings: [0, 18], amplitudes: [0, 120] },
  bomb: { timings: [0, 70], amplitudes: [0, 220] },
  boom: { timings: [0, BOOM_HIT_MS, BOOM_TAIL_MS], amplitudes: [0, 255, BOOM_TAIL_STRENGTH] },
};

type HapticsApi = Pick<
  typeof Haptics,
  'selectionAsync' | 'impactAsync' | 'notificationAsync' | 'performAndroidHapticsAsync'
>;

export function makeFeedback(deps: {
  os: string;
  /** modules/haptics: null off Android, or in a build made before it. */
  native: AppHapticsModule | null;
  haptics: HapticsApi;
  /** The player's Haptics setting. */
  enabled: () => boolean;
  later?: (run: () => void, ms: number) => void;
}) {
  const { os, native, haptics, enabled, later = (run, ms) => void setTimeout(run, ms) } = deps;
  const { ImpactFeedbackStyle: Impact, AndroidHaptics } = Haptics;
  const quiet = (p: Promise<void>) => void p.catch(() => {});
  const media = os === 'android' ? native : null;

  /** A moment: Android's media waveform when the module is here, or else expo-haptics. */
  const moment = (name: Moment, fallback: () => void) => () => {
    if (!enabled()) return;
    if (!media) return fallback();
    const { timings, amplitudes } = ANDROID_WAVES[name];
    try {
      media.play(timings, amplitudes, 'media');
    } catch {
      // A phone without a vibrator stays still.
    }
  };
  /** A control: the system's own click on Android, so it follows Touch feedback. */
  const control = (android: Haptics.AndroidHaptics, other: () => Promise<void>) => () => {
    if (!enabled()) return;
    quiet(os === 'android' ? haptics.performAndroidHapticsAsync(android) : other());
  };
  const impact = (style: Haptics.ImpactFeedbackStyle) => () => quiet(haptics.impactAsync(style));

  return {
    /** A wheel tick or a toggle. */
    tick: control(AndroidHaptics.Clock_Tick, () => haptics.selectionAsync()),
    /** An ordinary button. */
    press: control(AndroidHaptics.Virtual_Key, () => haptics.impactAsync(Impact.Light)),
    /** A Yes: the zero popping out of the button. */
    yes: moment('yes', impact(Impact.Medium)),
    /** A round finished, or a goal set. */
    success: moment('success', () => quiet(haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))),
    /** A Not today: acknowledged, gently. */
    soft: moment('soft', impact(Impact.Soft)),
    /** A zero shot down (the round throttles these). */
    kill: moment('kill', impact(Impact.Light)),
    /** A bomb going off. */
    bomb: moment('bomb', impact(Impact.Medium)),
    /** The last zero: the big explosion. */
    boom: moment('boom', () => {
      for (let i = 0; i < BOOM_IOS_HITS; i++) {
        if (i === 0) impact(Impact.Heavy)();
        else later(impact(Impact.Heavy), i * BOOM_IOS_GAP_MS);
      }
    }),
    /** The encouragement popping up after the round: a small tap. */
    cheer: moment('cheer', impact(Impact.Light)),
  };
}

export const feedback = makeFeedback({
  os: Platform.OS,
  native: AppHaptics,
  haptics: Haptics,
  enabled: () => appStore.getState().prefs.haptics,
});
