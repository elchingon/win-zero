// The shooting round. Until input and the HUD land, a real round is still the Phase 2
// stand-in (it shows what the round holds and finishes it). Development builds, and release
// builds made with EXPO_PUBLIC_PERF_BUILD=1 (eas build --profile perf), can open
// /play?practice=N to watch the game canvas render N zeros with a frame meter.
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { composeRound, equippedWeapon, type ZeroGroup } from '@/engine';
import { GameCanvas, type FrameStats } from '@/game/GameCanvas';
import type { GameConfig } from '@/game/sim/types';
import { plural } from '@/lib/format';
import { appStore, useApp } from '@/store';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { Screen } from '@/ui/Screen';
import { useReduceMotion } from '@/ui/useReduceMotion';

/** Practice rounds: development builds, and release builds made for measuring frame rate. */
const PRACTICE_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_PERF_BUILD === '1';
/** Practice rounds have every weapon. */
const PRACTICE_BEST = 100;
/** Practice rounds go up to this many zeros. */
const PRACTICE_MAX_N = 100_000;

function describe(group: ZeroGroup): string {
  if (group.kind === 'armored') {
    return `${plural(group.count, 'armored zero')} worth ×${group.value} each · ${group.hp} HP · energy bars`;
  }
  if (group.kind === 'energy') return `${plural(group.count, 'zero')} · ${group.hp} HP each · energy bars`;
  return `${plural(group.count, 'zero')} · one hit each`;
}

export default function Play() {
  const { replay, practice } = useLocalSearchParams<{ replay?: string; practice?: string }>();
  const practiceN = PRACTICE_ENABLED && practice ? Number(practice) : NaN;
  if (Number.isInteger(practiceN) && practiceN >= 1 && practiceN <= PRACTICE_MAX_N) return <Practice n={practiceN} />;
  return <RoundStandIn isReplay={replay === '1'} />;
}

const ignoreReport = () => {};

/** Development only: N zeros on the real canvas, no streak effects, with a frame meter. */
function Practice({ n }: { n: number }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const pick = useApp((s) => s.weapon);
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31));
  const [stats, setStats] = useState<FrameStats | null>(null);
  const config = useMemo<GameConfig>(
    () => ({
      n,
      groups: composeRound(n).groups,
      width,
      height,
      insetTop: insets.top,
      insetBottom: insets.bottom,
      weapon: equippedWeapon(pick, PRACTICE_BEST),
      seed,
      reduceMotion,
    }),
    [n, width, height, insets.top, insets.bottom, pick, seed, reduceMotion],
  );
  return (
    <View style={StyleSheet.absoluteFill}>
      <GameCanvas config={config} onReport={ignoreReport} onFrameStats={setStats} />
      <SafeAreaView style={styles.practice} pointerEvents="box-none">
        <View style={styles.meter} pointerEvents="none">
          <Text style={styles.meterText}>PRACTICE · {plural(n, 'ZERO', 'ZEROS')}</Text>
          <Text style={styles.meterText}>
            {stats ? `${stats.fps.toFixed(0)} FPS · WORST ${stats.worstMs.toFixed(1)} MS` : 'MEASURING…'}
          </Text>
        </View>
        <LinkButton label="Close" onPress={() => router.back()} />
      </SafeAreaView>
    </View>
  );
}

function RoundStandIn({ isReplay }: { isReplay: boolean }) {
  const round = useApp((s) => s.round);
  const goal = useApp((s) => s.goal);
  const pick = useApp((s) => s.weapon);
  if (!round || !goal) return <Redirect href="/" />;

  const composed = composeRound(round.n);
  const weapon = equippedWeapon(pick, goal.bestStreak);

  const finish = () => {
    feedback.success();
    if (!isReplay) appStore.getState().finishRound();
    router.replace(isReplay ? { pathname: '/result', params: { replay: '1' } } : '/result');
  };

  return (
    <Screen
      footer={
        <>
          <Button label="Finish round" onPress={finish} silent />
          <LinkButton label="Back to base" onPress={() => router.dismissTo('/')} />
        </>
      }
    >
      <View style={styles.hud}>
        <View>
          <View style={styles.count}>
            <Text style={type.hudCount}>{composed.n}</Text>
            <Text style={type.hudLabel}>/ {composed.n} LEFT</Text>
          </View>
          <Text style={[type.eyebrow, styles.day]}>DAY {round.n}</Text>
        </View>
        <View style={styles.weapon}>
          <Text style={styles.weaponLabel}>WEAPON</Text>
          <Text style={styles.weaponName}>{weapon.name}</Text>
          <Text style={styles.bombs}>● {plural(goal.bombs, 'bomb')}</Text>
        </View>
      </View>

      <Card>
        <Eyebrow>This round</Eyebrow>
        {composed.groups.map((g) => (
          <Text key={`${g.kind}-${g.value}`} style={styles.group}>
            {describe(g)}
          </Text>
        ))}
        <Fine>
          {plural(composed.objectCount, 'object')} on screen, worth {plural(composed.n, 'zero')}.
        </Fine>
      </Card>

      <Fine>
        The shooting round arrives in the next build. For now, finish the round to see your result.
        {isReplay ? ' This is a replay: nothing about your streak changes.' : ''}
      </Fine>
    </Screen>
  );
}

const styles = StyleSheet.create({
  practice: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: space.xl },
  meter: { gap: 2 },
  meterText: { fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 1, color: colors.teal },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  day: { marginTop: 4 },
  weapon: { alignItems: 'flex-end', gap: 2 },
  weaponLabel: { fontFamily: fonts.monoSemiBold, fontSize: 10, letterSpacing: 1, color: colors.muted },
  weaponName: { fontFamily: fonts.display, fontSize: 13, color: colors.teal },
  bombs: { fontFamily: fonts.monoSemiBold, fontSize: 12, color: colors.flare, marginTop: 4 },
  group: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: colors.fg },
});
