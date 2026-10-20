// Home's credits: how many Game and Weapon credits there are, the bonus round waiting to be played
// or a way to start one. A hint on each count opens what the credit is, how it's used and how to
// earn one.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CreditKind, CreditWallet } from '@/engine';
import type { BonusRound } from '@/store';
import { colors, fonts, type } from '@/theme/tokens';
import { Card, Eyebrow, shared, StatTile } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { creditCount, creditHelp, CREDITS_HELP, CREDITS_HOME } from '@/ui/copy/credits';
import { HintPopup } from '@/ui/HintPopup';

import { BonusRoundSheet } from './BonusRoundSheet';
import { CreditHelp } from './CreditHelp';

export function CreditsCard(props: {
  /** How far the shared arsenal reaches (arsenalBestOf): which weapons a credit could still lend. */
  best: number;
  credits: CreditWallet;
  bonus: BonusRound | null;
  /** Spend a Game credit on a bonus round of `n` zeros and open it. */
  onStartBonus: (n: number) => void;
  /** Open the bonus round already paid for. */
  onPlayBonus: () => void;
}) {
  const { best, credits, bonus, onStartBonus, onPlayBonus } = props;
  const [choosing, setChoosing] = useState(false);
  const [hint, setHint] = useState<CreditKind | null>(null);
  const { game, weapon } = credits.balance;
  const ready = bonus && !bonus.played ? bonus : null;
  const help = hint ? creditHelp(hint, credits, best, ready !== null) : null;
  const helpFor = (kind: CreditKind) => ({ label: CREDITS_HELP.button(kind), onPress: () => setHint(kind) });

  return (
    <View style={shared.section}>
      <Eyebrow header>{CREDITS_HOME.title}</Eyebrow>
      <View style={styles.row}>
        <StatTile
          label={CREDITS_HELP.title.game}
          value={String(game)}
          accessibilityLabel={creditCount('game', game)}
          help={helpFor('game')}
        />
        <StatTile
          label={CREDITS_HELP.title.weapon}
          value={String(weapon)}
          accessibilityLabel={creditCount('weapon', weapon)}
          help={helpFor('weapon')}
        />
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
      <HintPopup visible={help !== null} title={help?.title ?? ''} closeLabel={CREDITS_HELP.close} onClose={() => setHint(null)}>
        {help ? <CreditHelp help={help} /> : null}
      </HintPopup>
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
