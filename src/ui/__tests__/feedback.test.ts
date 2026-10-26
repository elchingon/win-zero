// Haptics per platform: Android's moments as media through modules/haptics, its taps the system's
// way, iPhone's through expo-haptics, and nothing at all with the setting off.
import { describe, expect, it, jest } from '@jest/globals';
import * as Haptics from 'expo-haptics';

import {
  ANDROID_WAVES,
  BOOM_HIT_MS,
  BOOM_IOS_GAP_MS,
  BOOM_IOS_HITS,
  BOOM_TAIL_MS,
  BOOM_TAIL_STRENGTH,
  makeFeedback,
} from '../feedback';
import type { HapticUsage } from '../../../modules/haptics';

function setup(os: 'ios' | 'android', opts: { native?: boolean; enabled?: boolean } = {}) {
  const played: { timings: readonly number[]; amplitudes: readonly number[]; usage: string }[] = [];
  const native =
    opts.native === false
      ? null
      : {
          play: (timings: readonly number[], amplitudes: readonly number[], usage: HapticUsage) => {
            played.push({ timings, amplitudes, usage });
          },
        };
  const haptics = {
    selectionAsync: jest.fn(async () => {}),
    impactAsync: jest.fn(async (_style?: Haptics.ImpactFeedbackStyle) => {}),
    notificationAsync: jest.fn(async (_type?: Haptics.NotificationFeedbackType) => {}),
    performAndroidHapticsAsync: jest.fn(async (_type: Haptics.AndroidHaptics) => {}),
  };
  const timers: { run: () => void; ms: number }[] = [];
  const feedback = makeFeedback({
    os,
    native,
    haptics,
    enabled: () => opts.enabled ?? true,
    later: (run, ms) => timers.push({ run, ms }),
  });
  return { feedback, played, haptics, timers };
}

describe('feedback on Android', () => {
  it('plays the moments as media, so the phone’s Touch feedback setting can’t drop them', () => {
    const { feedback, played, haptics } = setup('android');
    for (const moment of ['yes', 'success', 'soft', 'cheer', 'kill', 'bomb', 'boom'] as const) feedback[moment]();
    expect(played.map((p) => p.usage)).toEqual(Array(7).fill('media'));
    expect(played[0]).toEqual({ ...ANDROID_WAVES.yes, usage: 'media' });
    expect(haptics.impactAsync).not.toHaveBeenCalled();
    expect(haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('booms at twice the strength and length of the Heavy tap it replaced (60 ms at 70)', () => {
    const { feedback, played } = setup('android');
    feedback.boom();
    expect(played[0]).toEqual({ timings: [0, BOOM_HIT_MS, BOOM_TAIL_MS], amplitudes: [0, 255, BOOM_TAIL_STRENGTH], usage: 'media' });
    expect(BOOM_HIT_MS).toBe(2 * 60);
    expect(BOOM_TAIL_STRENGTH).toBe(2 * 70);
  });

  it('keeps every waveform’s steps and strengths in step, and in range', () => {
    for (const wave of Object.values(ANDROID_WAVES)) {
      expect(wave.timings).toHaveLength(wave.amplitudes.length);
      for (const a of wave.amplitudes) expect(a).toBeGreaterThanOrEqual(0);
      for (const a of wave.amplitudes) expect(a).toBeLessThanOrEqual(255);
    }
  });

  it('clicks taps and ticks the system’s way, under Touch feedback', () => {
    const { feedback, played, haptics } = setup('android');
    feedback.press();
    feedback.tick();
    expect(played).toEqual([]);
    expect(haptics.performAndroidHapticsAsync.mock.calls).toEqual([
      [Haptics.AndroidHaptics.Virtual_Key],
      [Haptics.AndroidHaptics.Clock_Tick],
    ]);
  });

  it('falls back to expo-haptics in a build without the module', () => {
    const { feedback, haptics } = setup('android', { native: false });
    feedback.kill();
    feedback.success();
    expect(haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });
});

describe('feedback on iPhone', () => {
  it('booms with two Heavy taps, a moment apart', () => {
    const { feedback, haptics, timers, played } = setup('ios');
    feedback.boom();
    expect(haptics.impactAsync.mock.calls).toEqual([[Haptics.ImpactFeedbackStyle.Heavy]]);
    expect(timers.map((t) => t.ms)).toEqual(Array.from({ length: BOOM_IOS_HITS - 1 }, (_, i) => (i + 1) * BOOM_IOS_GAP_MS));
    for (const t of timers) t.run();
    expect(haptics.impactAsync).toHaveBeenCalledTimes(BOOM_IOS_HITS);
    expect(played).toEqual([]);
  });

  it('pops a Yes with a medium tap, and keeps the rest as they were', () => {
    const { feedback, haptics } = setup('ios');
    feedback.yes();
    feedback.press();
    feedback.tick();
    expect(haptics.impactAsync.mock.calls).toEqual([[Haptics.ImpactFeedbackStyle.Medium], [Haptics.ImpactFeedbackStyle.Light]]);
    expect(haptics.selectionAsync).toHaveBeenCalledTimes(1);
    expect(haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });
});

describe('the Haptics setting', () => {
  it('silences everything when off', () => {
    for (const os of ['ios', 'android'] as const) {
      const { feedback, played, haptics, timers } = setup(os, { enabled: false });
      for (const f of Object.values(feedback)) f();
      expect(played).toEqual([]);
      expect(timers).toEqual([]);
      for (const fn of Object.values(haptics)) expect(fn).not.toHaveBeenCalled();
    }
  });
});
