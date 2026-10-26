import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';
import { APP_NAME, APP_WORDMARK } from '@/variant';

/** The top bar's mark, scaled up from the prototype's .mark; the website's /play matches it. */
const TOP_BAR_MARK_SIZE = 1.5;

/** The amber zero mark, as in the prototype's .mark. */
export function Mark({ size = 1 }: { size?: number }) {
  return (
    <View
      style={[
        styles.mark,
        { width: 18 * size, height: 24 * size, borderWidth: 5 * size, boxShadow: `0 0 ${14 * size}px ${colors.amber}8C` },
      ]}
    />
  );
}

/** The brand row with an optional action on the right. */
export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <View style={styles.bar}>
      {/* One element, so iOS reads the name as a heading rather than the wordmark as text. */}
      <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel={APP_NAME}>
        <Mark size={TOP_BAR_MARK_SIZE} />
        {/* Win Zero Plus's longer name shrinks to fit beside the bar's action on a narrow phone. */}
        <Text style={styles.word} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {APP_WORDMARK}
        </Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 14, flexShrink: 1 },
  mark: { borderColor: colors.amber, borderRadius: '50%' },
  word: { flexShrink: 1, fontFamily: fonts.display, fontSize: 28, letterSpacing: 0.56, color: colors.fg },
});
