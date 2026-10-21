// Before a round not yet played, Win Zero Plus asks which game to play it in (SPEC 9): one row per
// game, with its hint and the power-up the arsenal gives it now, the last pick marked. Tapping a
// row plays the round in that game; tapping outside the card or Android's back button plays the
// last pick.
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { modeTier, type ModeDef, type ModeId, type WeaponId } from '@/engine';
import { colors, fonts, fontScale, radii, space } from '@/theme/tokens';
import { MODE_COPY } from '@/ui/copy/modes';
import { feedback } from '@/ui/feedback';
import { Popup } from '@/ui/Popup';

import { MODE_PICKER } from '../copy';

/** The list scrolls past this share of the screen's height. */
const LIST_MAX_HEIGHT = 0.6;

export function ModePicker(props: {
  modes: readonly ModeDef[];
  /** The game picked last, which the round plays if nothing else is picked. */
  current: ModeId;
  /** The weapon the round starts with, which sets each game's power-up. */
  weapon: WeaponId;
  onPick: (id: ModeId) => void;
}) {
  const { modes, current, weapon, onPick } = props;
  // A screen reader moves to the question as the card lands.
  const title = useRef<Text>(null);
  const { height } = useWindowDimensions();

  return (
    <Popup onDismiss={() => onPick(current)} focus={title}>
      <View style={styles.head}>
        <Text ref={title} style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={fontScale.overlay}>
          {MODE_PICKER.title}
        </Text>
        <Text style={styles.body}>{MODE_PICKER.body}</Text>
      </View>
      <ScrollView style={{ maxHeight: height * LIST_MAX_HEIGHT }} contentContainerStyle={styles.list} bounces={false}>
        {modes.map((m) => {
          const last = m.id === current;
          const tier = `${MODE_COPY[m.id].tier}: ${modeTier(m.id, weapon)}`;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="button"
              accessibilityLabel={MODE_PICKER.option(m.name, MODE_COPY[m.id].hint, tier, last)}
              accessibilityHint={MODE_PICKER.optionHint}
              onPress={() => {
                feedback.press();
                onPick(m.id);
              }}
              style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
            >
              <View style={styles.top}>
                <Text style={styles.name}>{m.name}</Text>
                {last ? <Text style={styles.tag}>{MODE_PICKER.current}</Text> : null}
              </View>
              <Text style={styles.hint}>{MODE_COPY[m.id].hint}</Text>
              <Text style={styles.tier}>{tier}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Popup>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.sm },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.fg, textAlign: 'center' },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: 'center' },
  list: { gap: space.sm },
  row: {
    gap: space.xxs,
    padding: space.md,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.edge,
    backgroundColor: colors.panel2,
  },
  last: { borderColor: colors.amber },
  pressed: { opacity: 0.7 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  name: { flexShrink: 1, fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: colors.fg },
  tag: { fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.amber },
  hint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
  tier: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.teal },
});
