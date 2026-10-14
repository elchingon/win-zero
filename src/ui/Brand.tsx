import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

/** The amber zero mark, as in the prototype's .mark. */
export function Mark({ size = 1 }: { size?: number }) {
  return <View style={[styles.mark, { width: 18 * size, height: 24 * size, borderWidth: 5 * size }]} />;
}

/** The brand row with an optional action on the right. */
export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <View style={styles.bar}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Win Zero">
        <Mark />
        <Text style={styles.word}>WIN ZERO</Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: {
    borderColor: colors.amber,
    borderRadius: '50%',
    boxShadow: `0 0 14px ${colors.amber}8C`,
  },
  word: { fontFamily: fonts.display, fontSize: 19, letterSpacing: 0.38, color: colors.fg },
});
