// The round's heads-up display, from the prototype's #hud: zeros left and the day at the top
// left, sound and quit at the top right, the power-up switch (weapons, in the Shooter) and the
// bomb along the bottom, and the mode's hint that fades once play starts. It sits over the
// canvas; only its buttons take touches, so a finger anywhere else plays.
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ModeId } from '@/engine';
import { colors, fonts, fontScale, radii, type, withAlpha } from '@/theme/tokens';
import { MODE_COPY } from '@/ui/copy/modes';
import { feedback } from '@/ui/feedback';

/**
 * The hint stays this long, then fades over HINT_FADE_MS, even under reduce motion: Reanimated
 * would otherwise skip the delay there, and the hint would be gone on the first frame.
 */
const HINT_SHOW_MS = 2600;
const HINT_FADE_MS = 600;
/** The prototype's .hud-top / .hud-bottom padding. */
const EDGE = 14;
const GUTTER = 16;

/** HUD text grows with the OS text size only so far: the round keeps fixed bands clear for it. */
function HudText(props: TextProps) {
  return <Text maxFontSizeMultiplier={fontScale.overlay} {...props} />;
}

function Hint({ text }: { text: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.set(withDelay(HINT_SHOW_MS, withTiming(0, { duration: HINT_FADE_MS }), ReduceMotion.Never));
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[styles.hintRow, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <HudText style={styles.hint}>{text}</HudText>
    </Animated.View>
  );
}

function HudButton(props: {
  onPress: () => void;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** A toggle, read as a switch that's on or off. */
  checked?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { onPress, label, hint, disabled, checked, style, children } = props;
  return (
    <Pressable
      accessibilityRole={checked === undefined ? 'button' : 'switch'}
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
  /** "DAY 30", "BONUS" or "PRACTICE". */
  label: string;
  /** The game mode: its hint, and what it calls the power-up. */
  mode: ModeId;
  /** The power-up equipped, in the mode's words: "Rocket" in the Shooter. */
  tierName: string;
  /** The round has more than one power-up. */
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
  /** Clear the round at once. Offered while a screen reader is on, since the game is visual. */
  onFinish?: () => void;
  /** Development readouts, under the counter. */
  extra?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const p = props;
  const copy = MODE_COPY[p.mode];
  const tier = copy.tier.toUpperCase();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.top, { paddingTop: insets.top + EDGE }]} pointerEvents="box-none">
        <View pointerEvents="none" accessible accessibilityLabel={`${p.left} of ${p.total} zeros left. ${p.label}`}>
          <View style={styles.count}>
            <HudText style={[type.hudCount, styles.tabular]}>{p.left}</HudText>
            <HudText style={type.hudLabel}>/ {p.total} LEFT</HudText>
          </View>
          <HudText style={[type.eyebrow, styles.day]}>{p.label}</HudText>
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
            <HudText style={styles.buttonText}>{p.sound ? 'SOUND ON' : 'SOUND OFF'}</HudText>
          </HudButton>
          <HudButton onPress={p.onQuit} label="Leave the round" hint="Goes back to base" style={styles.quit}>
            <HudText style={[styles.buttonText, styles.quitText]}>✕</HudText>
          </HudButton>
        </View>
      </View>

      <Hint key={p.hintKey} text={copy.hint} />

      {p.controls ? (
        <View style={[styles.bottom, { bottom: insets.bottom + EDGE }]} pointerEvents="box-none">
          <HudButton
            onPress={() => {
              feedback.tick();
              p.onSwitchWeapon();
            }}
            label={`${copy.tier}: ${p.tierName}`}
            hint={p.canSwitch ? copy.switchHint : undefined}
            disabled={!p.canSwitch}
            style={styles.weapon}
          >
            <HudText style={styles.weaponSmall}>{p.canSwitch ? `${tier} · TAP TO SWITCH` : tier}</HudText>
            <HudText style={styles.weaponName} numberOfLines={1}>
              {p.tierName}
            </HudText>
          </HudButton>
          {p.onFinish ? (
            <HudButton onPress={p.onFinish} label="Finish round" hint="Clears every zero and ends the round">
              <HudText style={styles.buttonText}>FINISH ROUND</HudText>
            </HudButton>
          ) : null}
          <HudButton
            onPress={p.onBomb}
            label={`Bomb, ${p.bombs} left`}
            hint="Blasts every zero near the middle"
            disabled={!p.bombEnabled}
            style={styles.bomb}
          >
            <View style={styles.bombDot} />
            <HudText style={styles.bombCount}>{p.bombs}</HudText>
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
