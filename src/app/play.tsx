// Phase 2 stand-in for the shooting round (Phase 3): shows what the round will hold, and
// finishes it so the Yes → Play → Result flow can be tried end to end.
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { composeRound, equippedWeapon, type ZeroGroup } from '@/engine';
import { plural } from '@/lib/format';
import { appStore, useApp } from '@/store';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { Screen } from '@/ui/Screen';

function describe(group: ZeroGroup): string {
  if (group.kind === 'armored') {
    return `${plural(group.count, 'armored zero')} worth ×${group.value} each · ${group.hp} HP · energy bars`;
  }
  if (group.kind === 'energy') return `${plural(group.count, 'zero')} · ${group.hp} HP each · energy bars`;
  return `${plural(group.count, 'zero')} · one hit each`;
}

export default function Play() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const round = useApp((s) => s.round);
  const goal = useApp((s) => s.goal);
  const pick = useApp((s) => s.weapon);
  if (!round || !goal) return <Redirect href="/" />;

  const isReplay = replay === '1';
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
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  day: { marginTop: 4 },
  weapon: { alignItems: 'flex-end', gap: 2 },
  weaponLabel: { fontFamily: fonts.monoSemiBold, fontSize: 10, letterSpacing: 1, color: colors.muted },
  weaponName: { fontFamily: fonts.display, fontSize: 13, color: colors.teal },
  bombs: { fontFamily: fonts.monoSemiBold, fontSize: 12, color: colors.flare, marginTop: 4 },
  group: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: colors.fg },
});
