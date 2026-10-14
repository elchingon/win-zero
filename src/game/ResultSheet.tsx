// The result sheet, over the filled screen: the day, "N zeros down", what the Yes earned, and
// the next unlock. Rewards were applied when Yes was answered; this only reveals them. A
// replay or a practice round changes nothing, and says so.
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { nextUnlock, SHIELD_CAP, weaponById } from '@/engine';
import { formatCount, plural } from '@/lib/format';
import { useApp, type RoundRecord } from '@/store';
import { colors, fonts, space, type, withAlpha } from '@/theme/tokens';
import { Em, Eyebrow } from '@/ui/bits';
import { Button } from '@/ui/Button';

/** The prototype's #result: clear at the top, deepening to ink at 92% by 38% of the way down. */
const SCRIM = [withAlpha(colors.ink, 0), withAlpha(colors.ink, 0.92)];
const SCRIM_STOPS = [0, 0.38];
/** Room above the copy for the scrim to fade in, and below it, as in the prototype. */
const SCRIM_TOP = 80;
const BOTTOM = 28;
const RISE_MS = 500;

export type ResultMode = 'real' | 'replay' | 'practice';

interface Line {
  text: string;
  news?: boolean;
}

export function ResultSheet(props: {
  n: number;
  mode: ResultMode;
  /** The round's record: what the Yes earned. Absent for practice. */
  record: RoundRecord | null;
  onBack: () => void;
  onReplay: () => void;
}) {
  const { n, mode, record, onBack, onReplay } = props;
  const goal = useApp((s) => s.goal);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);

  const lines: Line[] = [];
  if (mode === 'practice') {
    lines.push({ text: 'Practice round: nothing about your streak changes.' });
  } else if (mode === 'replay') {
    lines.push({ text: "Replay: your streak and rewards don't change." });
  } else if (record && goal) {
    for (const id of record.rewards.weapons) {
      const w = weaponById(id);
      lines.push({ text: `New weapon unlocked: ${w.name}. ${w.description}`, news: true });
    }
    if (record.rewards.bomb) lines.push({ text: `Bomb earned. You have ${goal.bombs}.`, news: true });
    if (record.rewards.shield) lines.push({ text: `Shield earned. You have ${goal.shields} of ${SHIELD_CAP}.`, news: true });
    if (record.rewards.shieldCapped) lines.push({ text: `Shields full. You're holding all ${SHIELD_CAP}.` });
  }
  if (mode !== 'practice' && goal) {
    const next = nextUnlock(goal.bestStreak, n);
    lines.push({
      text: next
        ? `Hold the line ${plural(next.daysToGo, 'more day')} for the ${next.weapon.name}.`
        : `Tomorrow: ${plural(n + 1, 'zero')}.`,
    });
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(RISE_MS)}
      style={[styles.sheet, { paddingBottom: insets.bottom + BOTTOM }]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={SCRIM} positions={SCRIM_STOPS} />
        </Rect>
      </Canvas>
      <Eyebrow>{mode === 'practice' ? 'Practice' : `Day ${n}${goal ? ` · ${goal.goal}` : ''}`}</Eyebrow>
      <Text style={type.h2} accessibilityRole="header">
        <Em>{formatCount(n)}</Em> {n === 1 ? 'zero' : 'zeros'} down
      </Text>
      <View style={styles.lines}>
        {lines.map((l) => (
          <Text key={l.text} style={[styles.line, l.news && styles.news]}>
            {l.text}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
        <Button label="Back to base" onPress={onBack} style={styles.primary} />
        <Button label="Replay" variant="ghost" onPress={onReplay} style={styles.secondary} />
      </View>
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
  lines: { gap: space.xs },
  line: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.muted },
  news: { fontFamily: fonts.bodyBold, color: colors.teal },
  actions: { flexDirection: 'row', gap: 10, marginTop: space.xs },
  primary: { flex: 1.4 },
  secondary: { flex: 1 },
});
