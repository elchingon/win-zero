// The encouragement that pops up over the filled screen when a round lands: one line to carry
// into the next check-in, and Got it. Tapping outside the card or Android's back button
// dismisses it too; then the result sheet rises. The round plays the fanfare and the tap.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { colors, fonts, fontScale, space, withAlpha } from '@/theme/tokens';
import { Card } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { cheerDeck } from '@/ui/copy/cheers';

/** One deck for the session, so a replay gets the next line rather than a fresh shuffle. */
const nextCheer = cheerDeck();
const POP_MS = 320;
const CARD_MAX_WIDTH = 360;

export function CheerPopup({ onDismiss }: { onDismiss: () => void }) {
  // Picked once: the line stays put while the popup is up.
  const [text] = useState(nextCheer);
  const line = useRef<Text>(null);

  // A screen reader moves to the line as the card lands.
  useEffect(() => {
    const id = setTimeout(() => {
      if (line.current) AccessibilityInfo.sendAccessibilityEvent(line.current, 'focus');
    }, POP_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [onDismiss]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} accessibilityViewIsModal>
      <Animated.View entering={FadeIn.duration(POP_MS)} style={StyleSheet.absoluteFill}>
        <Pressable style={styles.backdrop} onPress={onDismiss} accessible={false} importantForAccessibility="no" />
      </Animated.View>
      <Animated.View entering={ZoomIn.duration(POP_MS)} style={styles.wrap}>
        <Card style={styles.card}>
          <Text ref={line} style={styles.line} maxFontSizeMultiplier={fontScale.overlay}>
            {text}
          </Text>
          <Button label="Got it" onPress={onDismiss} />
        </Card>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  backdrop: { flex: 1, backgroundColor: withAlpha(colors.ink, 0.55) },
  wrap: { width: '100%', maxWidth: CARD_MAX_WIDTH },
  card: { padding: space.xl, gap: space.lg },
  line: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 28, color: colors.fg, textAlign: 'center' },
});
