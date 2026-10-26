// Before a round: use a Weapon credit? Each weapon not yet unlocked, to borrow for this round and
// its replays, laid out like Home's arsenal, and Not this time. Tapping outside the card or
// Android's back button is Not this time too. In Win Zero Plus, each goes by the round's game
// mode's name for it (SPEC 9).
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { DEFAULT_MODE, type ModeId, type WeaponDef, type WeaponId } from '@/engine';
import { colors, fonts, fontScale, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { WEAPON_PROMPT } from '@/ui/copy/credits';
import { MODE_COPY, powerUp } from '@/ui/copy/modes';
import { feedback } from '@/ui/feedback';
import { Popup } from '@/ui/Popup';

/** The list scrolls past this share of the screen's height, so Not this time stays in reach. */
const LIST_MAX_HEIGHT = 0.45;

export function WeaponCreditPrompt(props: {
  offer: WeaponDef[];
  /** Weapon credits held. */
  credits: number;
  /** The game the round plays in. The Shooter when absent. */
  mode?: ModeId;
  onPick: (id: WeaponId) => void;
  onSkip: () => void;
}) {
  const { offer, credits, mode = DEFAULT_MODE, onPick, onSkip } = props;
  // A screen reader moves to the question as the card lands.
  const title = useRef<Text>(null);
  const { height } = useWindowDimensions();

  return (
    <Popup onDismiss={onSkip} focus={title}>
      <View style={styles.head}>
        <Text ref={title} style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={fontScale.overlay}>
          {WEAPON_PROMPT.title}
        </Text>
        <Text style={styles.body}>{WEAPON_PROMPT.body(credits, MODE_COPY[mode].tier.toLowerCase())}</Text>
      </View>
      <ScrollView style={[styles.list, { maxHeight: height * LIST_MAX_HEIGHT }]} bounces={false}>
        {offer.map((w) => {
          const p = powerUp(mode, w);
          return (
            <Pressable
              key={w.id}
              accessibilityRole="button"
              accessibilityLabel={WEAPON_PROMPT.option(w, p.name, p.description)}
              accessibilityHint={WEAPON_PROMPT.optionHint}
              onPress={() => {
                feedback.press();
                onPick(w.id);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.day}>DAY {w.unlockAt}</Text>
              <View style={styles.text}>
                <Text style={styles.name}>{p.name}</Text>
                {p.description ? <Text style={styles.desc}>{p.description}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Button label={WEAPON_PROMPT.skip} variant="ghost" onPress={onSkip} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.fg, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { opacity: 0.7 },
  day: { minWidth: 62, fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 0.88, color: colors.teal },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.fg },
  desc: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
});
