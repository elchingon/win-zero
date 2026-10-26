// A round a Yes earned, waiting on Home to be played. With several goals (Win Zero Plus), it names
// whose round it is.
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import type { RoundRecord } from '@/store';
import { colors, fonts, type } from '@/theme/tokens';
import { Card, Eyebrow } from '@/ui/bits';
import { Button } from '@/ui/Button';

export function ReadyRoundCard(props: { round: RoundRecord; goalId: string; goalName?: string }) {
  const { round, goalId, goalName } = props;
  return (
    <Card>
      {goalName ? <Eyebrow>{goalName}</Eyebrow> : null}
      <Text style={styles.cardTitle}>Your Day {round.n} round is ready.</Text>
      <Text style={type.lede}>Your rewards are already banked. Play it whenever you like.</Text>
      <Button
        label="Play now"
        accessibilityHint={goalName ? `Plays your Day ${round.n} round for “${goalName}”` : undefined}
        onPress={() => router.push({ pathname: '/play', params: { goal: goalId } })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
});
