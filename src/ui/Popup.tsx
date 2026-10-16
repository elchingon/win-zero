// A card that pops up over the screen and dims what's behind it: the encouragement after a round,
// and the question before one. Tapping outside the card or Android's back button dismisses it, and
// a screen reader moves to `focus` as the card lands.
import { useEffect, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, View, type Text } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { colors, space, withAlpha } from '@/theme/tokens';
import { Card } from '@/ui/bits';

const POP_MS = 320;
const CARD_MAX_WIDTH = 360;

export function Popup(props: { onDismiss: () => void; focus?: RefObject<Text | null>; children: ReactNode }) {
  const { onDismiss, focus, children } = props;

  useEffect(() => {
    const id = setTimeout(() => {
      if (focus?.current) AccessibilityInfo.sendAccessibilityEvent(focus.current, 'focus');
    }, POP_MS);
    return () => clearTimeout(id);
  }, [focus]);

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
        <Card style={styles.card}>{children}</Card>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  backdrop: { flex: 1, backgroundColor: withAlpha(colors.ink, 0.55) },
  wrap: { width: '100%', maxWidth: CARD_MAX_WIDTH },
  card: { padding: space.xl, gap: space.lg },
});
