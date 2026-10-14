// Home: the goal, the numbers, today's check-in (or when the next one comes), the arsenal,
// and the history calendar.
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dayKeyAt, nextWindow, pendingWindow, type AnswerRejection, type GoalState } from '@/engine';
import { formatWhen } from '@/lib/format';
import { appStore, useApp } from '@/store';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { Arsenal } from '@/ui/home/Arsenal';
import { CheckInCard } from '@/ui/home/CheckInCard';
import { HistoryCalendar } from '@/ui/home/HistoryCalendar';
import { startHomeRouting } from '@/ui/home/routing';
import { Stats } from '@/ui/home/Stats';
import { Screen } from '@/ui/Screen';
import { useDeviceCalendar } from '@/ui/useDevice';

// Development builds only: Metro folds __DEV__ to false in production and drops the require.
const DemoControls: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/DebugSection').DemoControls
  : null;

/** Re-check at least this often, in case the device clock jumps. */
const MAX_TIMER_MS = 60 * 60 * 1000;
/** Fire just after a window boundary, not on it. */
const BOUNDARY_SLACK_MS = 500;

const REJECTED: Record<AnswerRejection, string> = {
  expired: "That check-in closed before your answer. Here's where things stand now.",
  'already-answered': "You've already answered that one.",
  'not-open': "That check-in isn't open yet.",
};

export default function Home() {
  const goal = useApp((s) => s.goal);
  if (!goal) return <Redirect href="/setup" />;
  return <HomeScreen goal={goal} />;
}

function HomeScreen({ goal }: { goal: GoalState }) {
  const round = useApp((s) => s.round);
  const pick = useApp((s) => s.weapon);
  const selectWeapon = useApp((s) => s.selectWeapon);
  const rejection = useApp((s) => s.rejection);
  const clockOffset = useApp((s) => s.devClockOffsetMs); // re-render when the debug clock moves
  const { h24, firstWeekday } = useDeviceCalendar();
  const [tick, setTick] = useState(0);

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const pending = pendingWindow(goal, now);
  const next = nextWindow(goal);
  const boundary = (pending ? pending.closesAt : next.opensAt).getTime();

  // Show the card the moment a window opens, and settle it the moment it closes.
  useEffect(() => {
    const wait = Math.max(0, boundary - appStore.getState().now().getTime()) + BOUNDARY_SLACK_MS;
    const id = setTimeout(() => {
      appStore.getState().refresh();
      setTick((t) => t + 1);
    }, Math.min(MAX_TIMER_MS, wait));
    return () => clearTimeout(id);
  }, [boundary, tick, clockOffset]);

  // An answer, from the card here or a notification's buttons, leaves a screen to open: the
  // round for Yes, the notice for Not today. Otherwise, on focus and whenever days settle while
  // Home is showing (the app comes back to the foreground, a window closes), catch up and show
  // any Slipping / Reset / Shielded news once. One screen per visit (see routing.ts).
  useFocusEffect(useCallback(() => startHomeRouting(appStore, (path) => router.push(path)), []));

  const onYes = () => {
    feedback.success();
    appStore.getState().answer('yes');
  };

  const onNotToday = () => {
    feedback.soft();
    appStore.getState().answer('not-today');
  };

  const banner = rejection ? REJECTED[rejection] : null;

  const unplayed = round && !round.played ? round : null;
  const nextWhen = formatWhen(next.opensAt, now, tz, h24);

  return (
    <Screen>
      <TopBar right={<LinkButton label="Settings" onPress={() => router.push('/settings')} />} />

      <View style={styles.goal}>
        <Eyebrow>Daily goal</Eyebrow>
        <Text style={type.goal}>{goal.goal}</Text>
      </View>

      <Stats goal={goal} />

      {banner ? (
        <Card style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </Card>
      ) : null}

      {unplayed ? (
        <Card>
          <Text style={styles.cardTitle}>Your Day {unplayed.n} round is ready.</Text>
          <Text style={type.lede}>Your rewards are already banked. Play it whenever you like.</Text>
          <Button label="Play now" onPress={() => router.push('/play')} />
        </Card>
      ) : null}

      {pending ? (
        <CheckInCard
          key={pending.day}
          goal={goal}
          window={pending}
          now={now}
          tz={tz}
          h24={h24}
          onYes={onYes}
          onNotToday={onNotToday}
        />
      ) : goal.history.length === 0 ? (
        <Card>
          <Text style={styles.cardTitle}>You&apos;re all set.</Text>
          <Text style={type.lede}>Your first check-in is {nextWhen}.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.cardTitle}>
            {goal.history.at(-1)?.result === 'yes' ? "You've checked in." : 'Thanks for checking in.'}
          </Text>
          <Text style={type.lede}>Your next check-in is {nextWhen}.</Text>
        </Card>
      )}

      {goal.paused ? (
        <Fine>Reminders are paused after a long break. Check in whenever you&apos;re ready and they&apos;ll pick back up.</Fine>
      ) : null}

      <Arsenal goal={goal} pick={pick} onEquip={selectWeapon} />

      <HistoryCalendar goal={goal} today={dayKeyAt(now, tz)} pendingDay={pending?.day ?? null} firstWeekday={firstWeekday} />

      {DemoControls ? <DemoControls /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  goal: { gap: space.xs },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
  banner: { borderColor: colors.flare },
  bannerText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fg },
});
