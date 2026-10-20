// Buttons from the prototype: amber primary with the amber-deep ledge that presses down,
// ghost outline, a flare variant for destructive actions, and an underlined text link.
import { Pressable, StyleSheet, Text, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radii, type } from '@/theme/tokens';

import { feedback } from './feedback';

type Variant = 'primary' | 'ghost' | 'danger';

export function Button(props: {
  label: string;
  /** With the press, when the caller wants to know where it was. */
  onPress: (e: GestureResponderEvent) => void;
  variant?: Variant;
  small?: boolean;
  disabled?: boolean;
  /** Skip the default light tap, when the caller plays its own haptic. */
  silent?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { label, onPress, variant = 'primary', small, disabled, silent, accessibilityHint, style } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={(e) => {
        if (!silent) feedback.press();
        onPress(e);
      }}
      style={({ pressed }) => [
        styles.base,
        small && styles.small,
        styles[variant],
        pressed && pressedStyles[variant],
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[type.button, small && styles.smallLabel, labelStyles[variant]]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

export function LinkButton(props: { label: string; onPress: () => void; color?: string; accessibilityHint?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={props.accessibilityHint}
      onPress={props.onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.linkLabel, props.color ? { color: props.color } : null]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: radii.sm },
  smallLabel: { fontSize: 13 },
  primary: { backgroundColor: colors.amber, boxShadow: `0 4px 0 ${colors.amberDeep}` },
  ghost: { borderWidth: 1, borderColor: colors.line },
  danger: { borderWidth: 1, borderColor: colors.flare },
  disabled: { opacity: 0.4 },
  link: { paddingVertical: 6, alignSelf: 'flex-start' },
  linkLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
});

const pressedStyles = StyleSheet.create({
  primary: { transform: [{ translateY: 3 }], boxShadow: `0 1px 0 ${colors.amberDeep}` },
  ghost: { transform: [{ translateY: 2 }] },
  danger: { transform: [{ translateY: 2 }] },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.ink },
  ghost: { color: colors.fg },
  danger: { color: colors.flare },
});
