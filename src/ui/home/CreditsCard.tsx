// Home's credits: how many Game and Weapon credits there are, the bonus round waiting to be played
// or a way to start one, and in plain words what's next: how to earn more, or when a Weapon
// credit comes up.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { lockedWeapons, type CreditWallet, type GoalState } from '@/engine';
import type { BonusRound } from '@/store';
import { colors, fonts, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine, shared, StatTile } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { creditCount, creditsEarnedBy, CREDITS_HOME } from '@/ui/copy/credits';

import { BonusRoundSheet } from './BonusRoundSheet';

export function CreditsCard(props: {
  goal: GoalState;
  credits: CreditWallet;
  bonus: BonusRound | null;
  /** Spend a Game credit on a bonus round of `n` zeros and open it. */
  onStartBonus: (n: number) => void;
  /** Open the bonus round already paid for. */
  onPlayBonus: () => void;
}) {
  const { goal, credits, bonus, onStartBonus, onPlayBonus } = props;
  const [choosing, setChoosing] = useState(false);
  const { game, weapon } = credits.balance;
  const ready = bonus && !bonus.played ? bonus : null;

  const notes = [
    game > 0 ? (ready ? null : CREDITS_HOME.bonusAbout) : creditsEarnedBy('game', credits.claimed),
    weapon > 0
      ? lockedWeapons(goal.bestStreak).length > 0
        ? CREDITS_HOME.weaponWaiting
        : CREDITS_HOME.weaponAllUnlocked
      : creditsEarnedBy('weapon', credits.claimed),
  ].filter((n): n is string => n !== null);

  return (
    <View style={shared.section}>
      <Eyebrow header>{CREDITS_HOME.title}</Eyebrow>
      <View style={styles.row}>
        <StatTile label="Game credits" value={String(game)} accessibilityLabel={creditCount('game', game)} />
        <StatTile label="Weapon credits" value={String(weapon)} accessibilityLabel={creditCount('weapon', weapon)} />
      </View>
      {ready ? (
        <Card>
          <Text style={styles.cardTitle}>{CREDITS_HOME.bonusReady(ready.n)}</Text>
          <Text style={type.lede}>{CREDITS_HOME.bonusReadyLede}</Text>
          <Button label={CREDITS_HOME.playBonusNow} onPress={onPlayBonus} />
        </Card>
      ) : game > 0 ? (
        <Button
          label={CREDITS_HOME.playBonus}
          variant="ghost"
          accessibilityHint={CREDITS_HOME.playBonusHint}
          onPress={() => setChoosing(true)}
        />
      ) : null}
      {notes.map((note) => (
        <Fine key={note}>{note}</Fine>
      ))}
      <BonusRoundSheet
        visible={choosing}
        onCancel={() => setChoosing(false)}
        onStart={(n) => {
          setChoosing(false);
          onStartBonus(n);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
});
