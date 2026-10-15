// The round's heads-up display, from the prototype's #hud: zeros left and the day at the top
// left, sound and quit at the top right, the weapon switch and the bomb along the bottom, and
// a hint that fades once play starts. It sits over the canvas; only its buttons take touches,
// so a finger anywhere else aims and fires.
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, radii, type, withAlpha } from '@/theme/tokens';
import { feedback } from '@/ui/feedback';

/** The hint stays this long, then fades over HINT_FADE_MS. */
const HINT_SHOW_MS = 2600;
const HINT_FADE_MS = 600;
/** The prototype's .hud-top / .hud-bottom padding. */
const EDGE = 14;
const GUTTER = 16;

function Hint() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withDelay(HINT_SHOW_MS, withTiming(0, { duration: HINT_FADE_MS })));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View style={[styles.hintRow, style]} pointerEvents="none">
      <Text style={styles.hint}>Hold anywhere to fire</Text>
    </Animated.View>
  );
}

function HudButton(props: {
  onPress: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  checked?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { onPress, label, hint, disabled, checked, style, children } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, checked }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {children}
    </Pressable>
  );
}

export function Hud(props: {
  left: number;
  total: number;
  /** "DAY 30", or "PRACTICE". */
  label: string;
  weaponName: string;
  /** More than one weapon is unlocked. */
  canSwitch: boolean;
  onSwitchWeapon: () => void;
  bombs: number;
  bombEnabled: boolean;
  onBomb: () => void;
  sound: boolean;
  onToggleSound: () => void;
  onQuit: () => void;
  /** Weapon and bomb buttons; hidden once the round is won. */
  controls: boolean;
  /** Changes when a round starts, to show the hint again. */
  hintKey: number;
  /** Development readouts, under the counter. */
  extra?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const p = props;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.top, { paddingTop: insets.top + EDGE }]} pointerEvents="box-none">
        <View pointerEvents="none" accessible accessibilityLabel={`${p.left} of ${p.total} zeros left. ${p.label}`}>
          <View style={styles.count}>
            <Text style={[type.hudCount, styles.tabular]}>{p.left}</Text>
            <Text style={type.hudLabel}>/ {p.total} LEFT</Text>
          </View>
          <Text style={[type.eyebrow, styles.day]}>{p.label}</Text>
          {p.extra}
        </View>
        <View style={styles.topButtons}>
          <HudButton
            onPress={() => {
              feedback.tick();
              p.onToggleSound();
            }}
            label="Sound"
            checked={p.sound}
          >
            <Text style={styles.buttonText}>{p.sound ? 'SOUND ON' : 'SOUND OFF'}</Text>
          </HudButton>
          <HudButton onPress={p.onQuit} label="Leave the round" hint="Goes back to base" style={styles.quit}>
            <Text style={[styles.buttonText, styles.quitText]}>✕</Text>
          </HudButton>
        </View>
      </View>

      <Hint key={p.hintKey} />

      {p.controls ? (
        <View style={[styles.bottom, { bottom: insets.bottom + EDGE }]} pointerEvents="box-none">
          <HudButton
            onPress={() => {
              feedback.tick();
              p.onSwitchWeapon();
            }}
            label={`Weapon: ${p.weaponName}`}
            hint={p.canSwitch ? 'Switches to your next unlocked weapon' : undefined}
            disabled={!p.canSwitch}
            style={styles.weapon}
          >
            <Text style={styles.weaponSmall}>{p.canSwitch ? 'WEAPON · TAP TO SWITCH' : 'WEAPON'}</Text>
            <Text style={styles.weaponName} numberOfLines={1}>
              {p.weaponName}
            </Text>
          </HudButton>
          <HudButton
            onPress={p.onBomb}
            label={`Bomb, ${p.bombs} left`}
            hint="Blasts every zero near the middle"
            disabled={!p.bombEnabled}
            style={styles.bomb}
          >
            <View style={styles.bombDot} />
            <Text style={styles.bombCount}>{p.bombs}</Text>
          </HudButton>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: GUTTER,
    gap: 10,
  },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  tabular: { fontVariant: ['tabular-nums'] },
  day: { marginTop: 4 },
  topButtons: { flexDirection: 'row', gap: 8 },
  button: {
    backgroundColor: withAlpha(colors.panel, 0.85),
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  pressed: { transform: [{ translateY: 1 }], opacity: 0.85 },
  disabled: { opacity: 0.35 },
  buttonText: { fontFamily: fonts.monoSemiBold, fontSize: 12, letterSpacing: 0.72, color: colors.fg },
  quit: { paddingHorizontal: 11 },
  quitText: { color: colors.muted },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: GUTTER,
    gap: 10,
  },
  weapon: { gap: 2, maxWidth: '38%' },
  weaponSmall: { fontFamily: fonts.monoSemiBold, fontSize: 10, letterSpacing: 1, color: colors.muted },
  weaponName: { fontFamily: fonts.display, fontSize: 13, letterSpacing: 0.26, color: colors.teal },
  bomb: { flexDirection: 'row', alignItems: 'center', gap: 8, borderColor: colors.flare },
  bombDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.flare,
    boxShadow: `0 0 10px ${colors.flare}`,
  },
  bombCount: { fontFamily: fonts.display, fontSize: 14, color: colors.flare },
  hintRow: { position: 'absolute', top: '44%', left: 0, right: 0, alignItems: 'center' },
  hint: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 13,
    letterSpacing: 0.78,
    color: colors.fg,
    backgroundColor: withAlpha(colors.ink, 0.75),
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
});
