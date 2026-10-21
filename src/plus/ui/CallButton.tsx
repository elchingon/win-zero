// A small amber call to act beside a heading or title, such as Home's Edit and Add goal, in the
// look of Settings' "Edit" and "Add". Win Zero Plus only.
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, type } from '@/theme/tokens';
import { feedback } from '@/ui/feedback';

/** Reach past the small label, toward a 44-point touch target. */
const CALL_SLOP = { top: 14, bottom: 14, left: 12, right: 12 };

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
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Text style={styles.label}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  label: { ...type.eyebrow, color: colors.amber },
  pressed: { opacity: 0.6 },
});
