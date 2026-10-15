// What a render crash shows instead of a closed app: plain words that nothing is lost, and one
// way back. Self-contained, because the root boundary renders without the layout around it
// (no shared zero field, theme or status bar).
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/theme/tokens';
import { Em, Eyebrow, Lede } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

/** Development builds show the error itself, under the copy. */
const DEV_MESSAGE_LINES = 6;

export function CrashScreen(props: {
  eyebrow: string;
  title: [before: string, em: string];
  body: string[];
  action: string;
  onAction: () => void;
  error: Error;
}) {
  const { eyebrow, title, body, action, onAction, error } = props;
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Screen centered>
        <View style={styles.block}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Text style={type.h2} accessibilityRole="header">
            {title[0]}
            <Em>{title[1]}</Em>
          </Text>
        </View>
        <View style={styles.block}>
          {body.map((line) => (
            <Lede key={line}>{line}</Lede>
          ))}
        </View>
        <Button label={action} onPress={onAction} />
        {__DEV__ ? (
          <Text style={type.fine} numberOfLines={DEV_MESSAGE_LINES}>
            {error.message}
          </Text>
        ) : null}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  block: { gap: space.md },
});
