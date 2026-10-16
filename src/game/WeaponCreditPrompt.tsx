// Before a round: use a Weapon credit? Each weapon not yet unlocked, to borrow for this round and
// its replays, laid out like Home's arsenal, and Not this time. Tapping outside the card or
// Android's back button is Not this time too.
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { WeaponDef, WeaponId } from '@/engine';
import { colors, fonts, fontScale, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { WEAPON_PROMPT } from '@/ui/copy/credits';
import { feedback } from '@/ui/feedback';
import { Popup } from '@/ui/Popup';

/** The list scrolls past this share of the screen's height, so Not this time stays in reach. */
const LIST_MAX_HEIGHT = 0.45;

export function WeaponCreditPrompt(props: {
  offer: WeaponDef[];
  /** Weapon credits held. */
  credits: number;
  onPick: (id: WeaponId) => void;
  onSkip: () => void;
}) {
  const { offer, credits, onPick, onSkip } = props;
  // A screen reader moves to the question as the card lands.
  const title = useRef<Text>(null);
  const { height } = useWindowDimensions();

  return (
    <Popup onDismiss={onSkip} focus={title}>
      <View style={styles.head}>
        <Text ref={title} style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={fontScale.overlay}>
          {WEAPON_PROMPT.title}
        </Text>
        <Text style={styles.body}>{WEAPON_PROMPT.body(credits)}</Text>
      </View>
      <ScrollView style={[styles.list, { maxHeight: height * LIST_MAX_HEIGHT }]} bounces={false}>
        {offer.map((w) => (
          <Pressable
            key={w.id}
            accessibilityRole="button"
            accessibilityLabel={WEAPON_PROMPT.option(w)}
            accessibilityHint={WEAPON_PROMPT.optionHint}
            onPress={() => {
              feedback.press();
              onPick(w.id);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.day}>DAY {w.unlockAt}</Text>
            <View style={styles.text}>
              <Text style={styles.name}>{w.name}</Text>
              <Text style={styles.desc}>{w.description}</Text>
            </View>
          </Pressable>
        ))}
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
