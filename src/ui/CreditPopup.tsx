// A popup announcing new credits: after the first play of a round whose Yes earned a Game credit,
// and Win Zero Plus's secret on Home. A big amber "+1", a title, a line or two, and one button;
// tapping outside the card or Android's back button dismisses it too. Whoever shows it plays the
// sound and the haptic.
import { useRef } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, fonts, fontScale, type } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import type { CreditNews } from '@/ui/copy/credits';
import { Popup } from '@/ui/Popup';

export function CreditPopup({ news, onDismiss }: { news: CreditNews; onDismiss: () => void }) {
  // A screen reader moves to the title as the card lands, and reads the badge with it.
  const title = useRef<Text>(null);

  return (
    <Popup onDismiss={onDismiss} focus={title}>
      <Text ref={title} accessibilityRole="header" maxFontSizeMultiplier={fontScale.overlay} style={styles.heading}>
        <Text style={styles.badge}>{news.badge}</Text>
        {'\n'}
        {news.title}
      </Text>
      {news.lines.map((line) => (
        <Text key={line} style={[type.body, styles.line]}>
          {line}
        </Text>
      ))}
      <Button label={news.button} onPress={onDismiss} />
    </Popup>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30, color: colors.fg, textAlign: 'center' },
  badge: { fontSize: 56, lineHeight: 64, color: colors.amber },
  line: { textAlign: 'center' },
});
