// OS accessibility settings, kept current. (Reanimated's useReducedMotion only reads once.)
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

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

/** VoiceOver or TalkBack is on. */
export function useScreenReader(): boolean {
  return useA11yFlag(AccessibilityInfo.isScreenReaderEnabled, 'screenReaderChanged');
}
