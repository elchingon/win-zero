// What a credit count's hint says (creditHelp): what the credit is and how it's used, where things
// stand, and every way to earn one, with the ones already earned marked.
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space, type } from '@/theme/tokens';
import { Eyebrow, Fine } from '@/ui/bits';
import { CREDITS_HELP, type CreditHelp as Help } from '@/ui/copy/credits';

export function CreditHelp({ help }: { help: Help }) {
  return (
    <>
      {help.lines.map((line) => (
        <Text key={line} style={type.body}>
          {line}
        </Text>
      ))}
      {help.status ? <Text style={[type.body, styles.status]}>{help.status}</Text> : null}
      <View style={styles.ways}>
        <Eyebrow header>{CREDITS_HELP.earnTitle}</Eyebrow>
        {help.ways.map((way) => (
          <View
            key={way.label}
            style={styles.way}
            accessible
            accessibilityLabel={way.earned ? `${way.label}, ${CREDITS_HELP.earned.toLowerCase()}` : way.label}
          >
            <View style={[styles.ring, way.earned && styles.ringEarned]} />
            <Text style={[type.body, styles.label]}>{way.label}</Text>
            {way.earned ? <Text style={styles.earned}>{CREDITS_HELP.earned}</Text> : null}
          </View>
        ))}
      </View>
      <Fine>{CREDITS_HELP.footer}</Fine>
    </>
  );
}

const styles = StyleSheet.create({
  status: { color: colors.amber },
  ways: { gap: space.sm },
  way: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // A tiny zero by each way: muted until it's been earned, then teal.
  ring: { width: 9, height: 12, borderWidth: 2, borderColor: colors.edge, borderRadius: 6 },
  ringEarned: { borderColor: colors.teal },
  label: { flex: 1 },
  earned: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.teal,
  },
});
