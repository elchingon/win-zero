// A small amber call to act beside a heading or title, such as Home's Edit and Add goal, in the
// look of Settings' "Edit" and "Add". Win Zero Plus only.
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, type } from '@/theme/tokens';
import { feedback } from '@/ui/feedback';
import { MIN_TARGET, targetInset } from '@/ui/target';

/** About the label's line height. Its target takes back the rest, so the row keeps its size. */
const LABEL_LINE = 14;
/** Reach past the small label sideways too. */
const CALL_SLOP = { left: 12, right: 12 };

export function CallButton(props: { label: string; onPress: () => void; accessibilityHint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityHint={props.accessibilityHint}
      hitSlop={CALL_SLOP}
      onPress={() => {
        feedback.press();
        props.onPress();
      }}
      style={({ pressed }) => [styles.target, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: MIN_TARGET, marginVertical: targetInset(LABEL_LINE), justifyContent: 'center' },
  label: { ...type.eyebrow, color: colors.amber },
  pressed: { opacity: 0.6 },
});
