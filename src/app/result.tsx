// The result sheet: the day, "N zeros down", what the Yes earned, and the next unlock.
// Rewards were applied when Yes was answered; this only reveals them. Replay changes nothing.
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { nextUnlock, SHIELD_CAP, weaponById } from '@/engine';
import { plural } from '@/lib/format';
import { useApp } from '@/store';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Em, Eyebrow } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

export default function Result() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const round = useApp((s) => s.round);
  const goal = useApp((s) => s.goal);
  if (!round || !goal) return <Redirect href="/" />;

  const isReplay = replay === '1';
  const { n, rewards } = round;
  const lines: { text: string; news?: boolean }[] = [];
  if (isReplay) {
    lines.push({ text: "Replay: your streak and rewards don't change." });
  } else {
    for (const id of rewards.weapons) {
      const w = weaponById(id);
      lines.push({ text: `New weapon unlocked: ${w.name}. ${w.description}`, news: true });
    }
    if (rewards.bomb) lines.push({ text: `Bomb earned. You have ${goal.bombs}.`, news: true });
    if (rewards.shield) lines.push({ text: `Shield earned. You have ${goal.shields} of ${SHIELD_CAP}.`, news: true });
    if (rewards.shieldCapped) lines.push({ text: `Shields full. You're holding all ${SHIELD_CAP}.` });
  }
  const next = nextUnlock(goal.bestStreak, n);
  lines.push({
    text: next
      ? `Hold the line ${plural(next.daysToGo, 'more day')} for the ${next.weapon.name}.`
      : `Tomorrow: ${plural(n + 1, 'zero')}.`,
  });

  return (
    <Screen centered style={styles.bottom}>
      <Animated.View entering={FadeInDown.duration(500)} style={styles.sheet}>
        <Eyebrow>
          Day {n} · {goal.goal}
        </Eyebrow>
        <Text style={type.h2} accessibilityRole="header">
          <Em>{n}</Em> {n === 1 ? 'zero' : 'zeros'} down
        </Text>
        <View style={styles.lines}>
          {lines.map((l) => (
            <Text key={l.text} style={[styles.line, l.news && styles.news]}>
              {l.text}
            </Text>
          ))}
        </View>
        <View style={styles.actions}>
          <Button label="Back to base" onPress={() => router.dismissTo('/')} style={styles.primary} />
          <Button
            label="Replay"
            variant="ghost"
            onPress={() => router.replace({ pathname: '/play', params: { replay: '1' } })}
            style={styles.secondary}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bottom: { justifyContent: 'flex-end' },
  sheet: { gap: space.md },
  lines: { gap: space.xs },
  line: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.muted },
  news: { fontFamily: fonts.bodyBold, color: colors.teal },
  actions: { flexDirection: 'row', gap: 10, marginTop: space.xs },
  primary: { flex: 1.4 },
  secondary: { flex: 1 },
});
