// The big zero on the Reset / Shielded / Slipping screens (the prototype's .reset-zero), with a
// small motion for each: a reset settles in, a shield pulses as it absorbs, a slip sheds a zero.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

import { useReduceMotion } from './useReduceMotion';

export type NoticeMotion = 'settle' | 'absorb' | 'shed' | 'none';

const ZERO_W = 84;
const ZERO_H = 112;
const RING = 22;

export function NoticeZero({ color, motion }: { color: string; motion: NoticeMotion }) {
  const reduce = useReduceMotion();
  const still = reduce || motion === 'none';
  const scale = useSharedValue(still ? 1 : 0.6);
  const pulse = useSharedValue(0);
  const shed = useSharedValue(0);

  useEffect(() => {
    if (still) {
      scale.set(1);
      return;
    }
    scale.set(withSpring(1, { damping: 9, stiffness: 140 }));
    if (motion === 'absorb') {
      pulse.set(withDelay(250, withRepeat(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), 2, false)));
    }
    if (motion === 'shed') {
      shed.set(withDelay(400, withSequence(withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) }))));
    }
  }, [still, motion, scale, pulse, shed]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.get()) * 0.8,
    transform: [{ scale: 1 + pulse.get() * 0.7 }],
  }));
  const shedStyle = useAnimatedStyle(() => ({
    opacity: 1 - shed.get(),
    transform: [{ translateY: shed.get() * 90 }, { rotate: `${shed.get() * 40}deg` }],
  }));

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {motion === 'absorb' && !still ? (
        <Animated.View style={[styles.zero, { borderColor: color, borderWidth: 4 }, pulseStyle]} />
      ) : null}
      <Animated.View
        style={[styles.zero, { borderColor: color, boxShadow: `0 0 30px ${color}80` }, ringStyle]}
      />
      {motion === 'shed' && !still ? (
        <Animated.View style={[styles.small, { borderColor: color }, shedStyle]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: ZERO_W, height: ZERO_H + 40, justifyContent: 'flex-start' },
  zero: {
    position: 'absolute',
    top: 0,
    width: ZERO_W,
    height: ZERO_H,
    borderWidth: RING,
    borderRadius: '50%',
  },
  small: {
    position: 'absolute',
    top: ZERO_H - 30,
    left: ZERO_W / 2 - 10,
    width: 20,
    height: 27,
    borderWidth: 5,
    borderRadius: '50%',
  },
});

export const noticeColors = { reset: colors.flare, shielded: colors.teal, slipping: colors.amber, noted: colors.amber };
