// Home's way to Win Zero Plus (SPEC 9), in Win Zero once Plus is on the store: a small "+" that opens
// a card saying what Plus adds. Nothing opens it but the "+", and it carries no badge.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PLAYABLE_MODES } from '@/engine';
import { PLUS_LIMITS } from '@/store/limits';
import { colors, fonts, space, type } from '@/theme/tokens';
import { useAnimationMotion } from '@/ui/a11y';
import { Card, Fine } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { MIN_TARGET, targetInset } from '@/ui/target';
import { PLUS_APP_NAME } from '@/variant';

const TOGGLE_SIZE = 22;
const ICON_SIZE = 52;
/** The Plus icon's corners, as its home-screen icon rounds them (src/plus/ui/MiniIcon.tsx). */
const ICON_RADIUS = 0.22;

const PLUS_ICON = require('../../../assets/brand-plus/icon.png');

const GAMES = PLAYABLE_MODES.length;

const BENEFITS = [
  'Play as many bonus rounds as you want',
  `Track up to ${PLUS_LIMITS.maxGoals} goals, on the days you choose`,
  `Play ${GAMES} kinds of games`,
  'Pick your themes and app icons',
];

/** What Plus adds, in a line: Settings' row. */
export const PLUS_PITCH = `More goals, ${GAMES} games, themes and as many bonus rounds as you want.`;

/** The small "+" beside Home's goal heading; a "×" while the card is open. */
export function PlusPromoToggle({ open, onPress }: { open: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`What ${PLUS_APP_NAME} adds`}
      accessibilityState={{ expanded: open }}
      onPress={() => {
        feedback.press();
        onPress();
      }}
      style={({ pressed }) => [styles.target, pressed && { opacity: 0.6 }]}
    >
      <View style={styles.ring}>
        <Text style={styles.glyph} maxFontSizeMultiplier={1} importantForAccessibility="no">
          {open ? '×' : '+'}
        </Text>
      </View>
    </Pressable>
  );
}

export function PlusPromoCard({ onGet, onMove }: { onGet: () => void; onMove: () => void }) {
  const motion = useAnimationMotion();
  return (
    <Animated.View entering={FadeIn.reduceMotion(motion)}>
      <Card style={styles.card}>
        <View style={styles.head}>
          {/* Its name is the title beside it. */}
          <Image source={PLUS_ICON} style={styles.icon} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={styles.title} accessibilityRole="header">
            Get more with {PLUS_APP_NAME}
          </Text>
        </View>
        <View style={styles.benefits}>
          {BENEFITS.map((line) => (
            <View key={line} style={styles.benefit}>
              <Text style={styles.plus} importantForAccessibility="no" accessibilityElementsHidden>
                +
              </Text>
              <Text style={styles.line}>{line}</Text>
            </View>
          ))}
        </View>
        <Fine>Pay once. No ads or subscriptions.</Fine>
        <Button label={`See ${PLUS_APP_NAME}`} accessibilityHint="Opens its store page" onPress={onGet} />
        <LinkButton label="Already have it? Move your progress" onPress={onMove} />
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  target: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    margin: targetInset(TOGGLE_SIZE),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: TOGGLE_SIZE,
    height: TOGGLE_SIZE,
    borderRadius: TOGGLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 18, color: colors.amber },
  card: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE * ICON_RADIUS },
  title: { ...type.question, flex: 1 },
  benefits: { gap: space.sm },
  benefit: { flexDirection: 'row', gap: space.sm },
  plus: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21, color: colors.amber },
  line: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.fg },
});
