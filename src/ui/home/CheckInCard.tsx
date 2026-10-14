// The in-app check-in, styled like the notification it mirrors (the prototype's .notif card).
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { isWindowToday, notTodayPreview, type CheckInWindow, type GoalState, type TimeZone } from '@/engine';
import { formatInstantTime, plural } from '@/lib/format';
import { colors, fonts, fontScale, radii, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';

/** What each answer would do, in plain words. */
function stakes(goal: GoalState): string {
  const yes = `Yes: ${plural(goal.streak + 1, 'zero')} to shoot.`;
  const no = notTodayPreview(goal);
  if (no.kind === 'shield') return `${yes} Not today: a shield keeps your streak.`;
  if (no.lose === 0) return yes;
  if (no.kind === 'reset') return `${yes} Not today: a fresh start, from one zero.`;
  return `${yes} Not today: one zero comes off.`;
}

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
  // At large text sizes the buttons stack, so their labels needn't shrink to fit side by side.
  const stack = useWindowDimensions().fontScale > fontScale.stackButtons;
  return (
    <Animated.View entering={FadeInDown.springify().damping(14)} style={styles.card} accessibilityRole="summary">
      <View style={styles.head}>
        <View style={styles.app}>
          <View style={styles.appRing} />
        </View>
        <Text style={styles.headText}>WIN ZERO</Text>
        <Text style={[styles.headText, styles.when]}>{formatInstantTime(window.opensAt, tz, h24)}</Text>
      </View>
      <Text style={styles.question}>
        Did you stick to “{goal.goal}” {when}?
      </Text>
      <Text style={styles.stakes}>{stakes(goal)}</Text>
      <View style={[styles.actions, stack && styles.stacked]}>
        <Button label="Yes, I did" onPress={onYes} silent style={!stack && styles.yes} />
        <Button label="Not today" variant="ghost" onPress={onNotToday} silent style={!stack && styles.no} />
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
  actions: { flexDirection: 'row', gap: 10 },
  stacked: { flexDirection: 'column' },
  yes: { flex: 1.2 },
  no: { flex: 1 },
});
