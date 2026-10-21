// OS accessibility settings, kept current (Reanimated's useReducedMotion only reads once), and
// the app's own switches in Settings › Accessibility that go with them.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';

import { useApp } from '@/store';

type FlagEvent = 'reduceMotionChanged' | 'screenReaderChanged';

function useA11yFlag(read: () => Promise<boolean>, event: FlagEvent): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    read()
      .then((value) => alive && setOn(value))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(event, setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, [read, event]);
  return on;
}

/** The OS reduce-motion setting. */
export function useReduceMotion(): boolean {
  return useA11yFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged');
}

/**
 * Calm effects: the OS reduce-motion setting, or Reduce effects in Settings › Accessibility. Use
 * this, not useReduceMotion, for anything the app moves itself.
 */
export function useReduceEffects(): boolean {
  const os = useReduceMotion();
  const chosen = useApp((s) => s.prefs.reduceEffects);
  return os || chosen;
}

/** For Reanimated's entering animations, which follow only the OS: reduced too while Reduce effects is on. */
export function useAnimationMotion(): ReduceMotion {
  return useApp((s) => s.prefs.reduceEffects) ? ReduceMotion.Always : ReduceMotion.System;
}

/** VoiceOver or TalkBack is on. */
export function useScreenReader(): boolean {
  return useA11yFlag(AccessibilityInfo.isScreenReaderEnabled, 'screenReaderChanged');
}
