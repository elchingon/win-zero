// The in-app check-in, styled like the notification it mirrors (the prototype's .notif card).
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { isWindowToday, type CheckInWindow, type GoalState, type TimeZone } from '@/engine';
import { formatInstantTime, formatUntil } from '@/lib/format';
import { colors, fonts, fontScale, radii, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { APP_WORDMARK } from '@/variant';

import { checkInStakes, stakesHint, stakesLine } from './stakes';

export function CheckInCard(props: {
  goal: GoalState;
  window: CheckInWindow;
  now: Date;
  /** The device's time zone: times show as the phone's clock reads them. */
  tz: TimeZone;
  h24: boolean;
  onYes: () => void;
  onNotToday: () => void;
}) {
  const { goal, window, now, tz, h24, onYes, onNotToday } = props;
  const when = isWindowToday(window, now) ? 'today' : 'yesterday';
  const stakes = checkInStakes(goal);
  // At large text sizes the buttons stack, so their labels needn't shrink to fit side by side.
  const stack = useWindowDimensions().fontScale > fontScale.stackButtons;
  return (
    <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.card}>
      {/* Dressed like a notification; screen readers start at the question. */}
      <View style={styles.head} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.app}>
          <View style={styles.appRing} />
        </View>
        <Text style={styles.headText}>{APP_WORDMARK}</Text>
        <Text style={[styles.headText, styles.when]}>{formatInstantTime(window.opensAt, tz, h24)}</Text>
      </View>
      <Text style={styles.question}>
        Did you stick to “{goal.goal}” {when}?
      </Text>
      <View style={styles.lines}>
        <Text style={styles.stakes}>{stakesLine(stakes)}</Text>
        <Text style={styles.until}>Open until {formatUntil(window.closesAt, now, tz, h24)}.</Text>
      </View>
      <View style={[styles.actions, stack && styles.stacked]}>
        <Button
          label="Yes, I did"
          onPress={onYes}
          silent
          accessibilityHint={stakesHint(stakes.yes)}
          style={!stack && styles.yes}
        />
        <Button
          label="Not today"
          variant="ghost"
          onPress={onNotToday}
          silent
          accessibilityHint={stakes.notToday ? stakesHint(stakes.notToday) : undefined}
          style={!stack && styles.no}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xxl,
    padding: 14,
    gap: space.md,
    boxShadow: '0 18px 40px -18px #000',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  app: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appRing: { width: 7, height: 10, borderWidth: 2.5, borderColor: colors.ink, borderRadius: '50%' },
  headText: { fontFamily: fonts.monoSemiBold, fontSize: 12, letterSpacing: 0.96, color: colors.muted },
  when: { marginLeft: 'auto' },
  question: { fontFamily: fonts.bodyBold, fontSize: 19, lineHeight: 24, color: colors.fg },
  stakes: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted },
  lines: { gap: space.xs },
  until: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
  actions: { flexDirection: 'row', gap: 10 },
  stacked: { flexDirection: 'column' },
  yes: { flex: 1.2 },
  no: { flex: 1 },
});
