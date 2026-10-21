// Saying something to VoiceOver or TalkBack without moving focus. Kept apart from a11y.ts, which
// brings in Reanimated, so plain building blocks like Field can use it.
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Says `message` to VoiceOver or TalkBack, without moving focus, each time it changes to new words
 * (a field's error appearing, say). Not what it says on first render: that is read in place.
 */
export function useAnnounce(message: string | null | undefined): void {
  const said = useRef(message);
  useEffect(() => {
    if (message && message !== said.current) AccessibilityInfo.announceForAccessibility(message);
    said.current = message;
  }, [message]);
}
