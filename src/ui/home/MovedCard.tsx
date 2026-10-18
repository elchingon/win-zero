// Home's cards for a move to Win Zero Plus (SPEC 9): where the goals went once Plus confirmed, or
// whether a move Plus never confirmed finished.
import { StyleSheet, Text } from 'react-native';

import { colors, fonts, type } from '@/theme/tokens';
import { Card, Fine } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';

export function MovedCard(props: { onOpen: () => void; onStay: () => void }) {
  return (
    <Card>
      <Text style={styles.title}>Your goals now live in Win Zero Plus.</Text>
      <Text style={type.lede}>Your check-ins and reminders come from there now, so you won&apos;t get two.</Text>
      <Button label="Open Win Zero Plus" onPress={props.onOpen} />
      <LinkButton label="Keep using Win Zero here" accessibilityHint="Turns reminders back on in Win Zero" onPress={props.onStay} />
      <Fine>
        Your progress here is as you left it when you moved. If you keep using Win Zero, the days since count like
        any break.
      </Fine>
    </Card>
  );
}

export function MoveCheckCard(props: { busy: boolean; onYes: () => void; onRetry: () => void; onCancel: () => void }) {
  return (
    <Card>
      <Text style={styles.title}>Did your move finish?</Text>
      <Text style={type.lede}>
        If your goals are in Win Zero Plus, Win Zero can stop its reminders here. Nothing changes in Plus.
      </Text>
      <Button label="Yes, stop reminders here" onPress={props.onYes} />
      <Button variant="ghost" label="Try again" disabled={props.busy} onPress={props.onRetry} />
      <LinkButton label="Cancel move" accessibilityHint="Keeps Win Zero as it is" onPress={props.onCancel} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
});
