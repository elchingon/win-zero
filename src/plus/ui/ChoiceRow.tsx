// One choice in a list of them (Settings › Games, Themes): a radio row, read out as checked or
// not, and as dimmed while it isn't open yet. Win Zero Plus only.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '@/theme/tokens';
import { feedback } from '@/ui/feedback';

export function ChoiceRow(props: {
  label: string;
  detail?: string;
  /** Beside the label: a swatch, say. */
  left?: ReactNode;
  checked: boolean;
  /** Not open yet: shown dimmed, and a tap does nothing. */
  disabled?: boolean;
  /** Read out instead of the label and detail. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
}) {
  const { label, detail, left, checked, disabled = false } = props;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={props.accessibilityLabel ?? (detail ? `${label}. ${detail}` : label)}
      accessibilityHint={disabled || checked ? undefined : props.accessibilityHint}
      disabled={disabled}
      onPress={() => {
        if (checked) return;
        feedback.tick();
        props.onPress();
      }}
      style={({ pressed }) => [styles.row, disabled && styles.locked, pressed && !checked && { opacity: 0.7 }]}
    >
      {left}
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <View style={[styles.radio, checked && styles.radioOn]}>{checked ? <View style={styles.dot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  locked: { opacity: 0.5 },
  text: { flex: 1, gap: 2 },
  label: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.fg },
  detail: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.amber },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.amber },
});
