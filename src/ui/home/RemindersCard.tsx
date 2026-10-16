// Home's card while reminders are off: turn them on (or open system settings, once the OS won't
// ask again), or hide the card for a week.
import { StyleSheet, Text } from 'react-native';

import { colors, fonts, type } from '@/theme/tokens';
import { Card } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';

export function RemindersCard(props: {
  /** Turned off in system settings, rather than never turned on. */
  denied: boolean;
  /** The check-in time, formatted for this device. */
  checkInTime: string;
  onTurnOn: () => void;
  onHide: () => void;
}) {
  const { denied, checkInTime, onTurnOn, onHide } = props;
  return (
    <Card>
      <Text style={styles.title}>Reminders are off.</Text>
      <Text style={type.lede}>
        {denied
          ? "They're turned off in your phone's settings. Turn them on there and your check-in will find you."
          : `Win Zero asks one question each day at ${checkInTime}. A reminder makes sure it finds you.`}
      </Text>
      <Button label={denied ? 'Open settings' : 'Turn on reminders'} onPress={onTurnOn} />
      <LinkButton label="Not now" accessibilityHint="Hides this for a week" onPress={onHide} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
});
