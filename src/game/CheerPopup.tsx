// The encouragement that pops up over the filled screen when a round lands: one line to carry
// into the next check-in, and Got it. Tapping outside the card or Android's back button
// dismisses it too; then the result sheet rises. The round plays the fanfare and the tap.
import { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, fonts, fontScale } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { cheerDeck } from '@/ui/copy/cheers';
import { Popup } from '@/ui/Popup';

/** One deck for the session, so a replay gets the next line rather than a fresh shuffle. */
const nextCheer = cheerDeck();

export function CheerPopup({ onDismiss }: { onDismiss: () => void }) {
  // Picked once: the line stays put while the popup is up.
  const [text] = useState(nextCheer);
  // A screen reader moves to the line as the card lands.
  const line = useRef<Text>(null);

  return (
    <Popup onDismiss={onDismiss} focus={line}>
      <Text ref={line} style={styles.line} maxFontSizeMultiplier={fontScale.overlay}>
        {text}
      </Text>
      <Button label="Got it" onPress={onDismiss} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  line: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 28, color: colors.fg, textAlign: 'center' },
});
