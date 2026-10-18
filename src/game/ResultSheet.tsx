// The result sheet, over the filled screen: the day, "N zeros down", what the Yes earned, and
// the next unlock. Rewards were applied when Yes was answered; this only reveals them. A
// replay, a bonus round or a practice round changes nothing, and says so.
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCount } from '@/lib/format';
import { primaryGoal, useApp, type RoundRecord } from '@/store';
import { colors, fonts, fontScale, space, type, withAlpha } from '@/theme/tokens';
import { Em, Eyebrow } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';
import { APP_NAME } from '@/variant';

import { resultLines, sheetEyebrow, type ResultMode } from './result';
import { milestoneShareText, shareMilestone } from './share';

export type { ResultMode } from './result';

/** The prototype's #result: clear at the top, deepening to ink at 92% by 38% of the way down. */
const SCRIM = [withAlpha(colors.ink, 0), withAlpha(colors.ink, 0.92)];
const SCRIM_STOPS = [0, 0.38];
/** Room above the copy for the scrim to fade in, and below it, as in the prototype. */
const SCRIM_TOP = 80;
const BOTTOM = 28;
const RISE_MS = 500;

export function ResultSheet(props: {
  n: number;
  mode: ResultMode;
  /** The day's round: what the Yes earned. Absent for bonus and practice rounds. */
  record: RoundRecord | null;
  onBack: () => void;
  onReplay: () => void;
}) {
  const { n, mode, record, onBack, onReplay } = props;
  // A round that earned something can be shared; practice rounds earn nothing.
  const shareText = mode !== 'practice' && record ? milestoneShareText(record.n, record.rewards, APP_NAME) : null;
  const goal = useApp(primaryGoal);
  const credits = useApp((s) => s.credits);
  const { width, height: screenHeight, fontScale: textScale } = useWindowDimensions();
  // At large text sizes the buttons stack, so their labels needn't shrink to fit side by side.
  const stack = textScale > fontScale.stackButtons;
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const header = useRef<Text>(null);

  // A screen reader moves to the sheet as it lands, starting at "N zeros down".
  useEffect(() => {
    const id = setTimeout(() => {
      if (header.current) AccessibilityInfo.sendAccessibilityEvent(header.current, 'focus');
    }, RISE_MS);
    return () => clearTimeout(id);
  }, []);

  const lines = resultLines(n, mode, record, goal, credits);

  return (
    <Animated.View
      entering={FadeInDown.duration(RISE_MS)}
      style={[styles.sheet, { paddingBottom: insets.bottom + BOTTOM, maxHeight: screenHeight - insets.top }]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      accessibilityViewIsModal
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={SCRIM} positions={SCRIM_STOPS} />
        </Rect>
      </Canvas>
      <Eyebrow>{sheetEyebrow(mode, n, goal)}</Eyebrow>
      <Text ref={header} style={type.h2} accessibilityRole="header" maxFontSizeMultiplier={fontScale.overlay}>
        <Em>{formatCount(n)}</Em> {n === 1 ? 'zero' : 'zeros'} down
      </Text>
      {/* Scrolls only when large text makes the lines taller than the screen allows. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.lines} bounces={false}>
        {lines.map((l) => (
          <Text key={l.text} style={[styles.line, l.news && styles.news]}>
            {l.text}
          </Text>
        ))}
      </ScrollView>
      <View style={[styles.actions, stack && styles.stacked]}>
        <Button label="Back to base" onPress={onBack} style={!stack && styles.primary} />
        <Button label="Replay" variant="ghost" onPress={onReplay} style={!stack && styles.secondary} />
      </View>
      {shareText ? (
        <LinkButton
          label="Share this milestone"
          accessibilityHint="Opens the share sheet. Your goal's wording isn't included."
          onPress={() => shareMilestone(shareText)}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.xl,
    paddingTop: SCRIM_TOP,
    gap: space.md,
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  lines: { gap: space.xs },
  line: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.muted },
  news: { fontFamily: fonts.bodyBold, color: colors.teal },
  actions: { flexDirection: 'row', gap: 10, marginTop: space.xs },
  stacked: { flexDirection: 'column' },
  primary: { flex: 1.4 },
  secondary: { flex: 1 },
});
