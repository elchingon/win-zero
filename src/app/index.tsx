// Home: the goal, the numbers, today's check-in (or when the next one comes), credits and the
// bonus round, the arsenal, and the history calendar. Once Win Zero has moved to Win Zero Plus
// (SPEC 9), only where the goals went.
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';

import {
  currentCheckInTime,
  dayKeyAt,
  nextWindow,
  openedAtSetup,
  pendingWindow,
  type GoalState,
} from '@/engine';
import { formatClockTime, formatWhen } from '@/lib/format';
import { appStore, isMovedOut, primaryGoal, primaryRound, useApp } from '@/store';
import { cancelMove, confirmMoveByHand, openPlus, sendMoveOut } from '@/transfer/send';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { REJECTED } from '@/ui/copy/rules';
import { feedback } from '@/ui/feedback';
import { Arsenal } from '@/ui/home/Arsenal';
import { CheckInCard } from '@/ui/home/CheckInCard';
import { CreditsCard } from '@/ui/home/CreditsCard';
import { HistoryCalendar } from '@/ui/home/HistoryCalendar';
import { moveCardFor, moveCheckAt } from '@/ui/home/moved';
import { MoveCheckCard, MovedCard } from '@/ui/home/MovedCard';
import { RemindersCard } from '@/ui/home/RemindersCard';
import { remindersCardVisible } from '@/ui/home/remindersOff';
import { startHomeRouting } from '@/ui/home/routing';
import { Stats } from '@/ui/home/Stats';
import { Screen } from '@/ui/Screen';
import { useDeviceCalendar } from '@/ui/useDevice';
import { useReminderPermission } from '@/ui/useReminderPermission';
import { FEATURES } from '@/variant';

// Development builds only: Metro folds __DEV__ to false in production and drops the require.
const DemoControls: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/DebugSection').DemoControls
  : null;

/** Re-check at least this often, in case the device clock jumps. */
const MAX_TIMER_MS = 60 * 60 * 1000;
/** Fire just after a window boundary, not on it. */
const BOUNDARY_SLACK_MS = 500;

export default function Home() {
  const goal = useApp(primaryGoal);
  const moved = useApp(isMovedOut);
  if (!goal) return <Redirect href="/setup" />;
  if (moved) return <MovedHome />;
  return <HomeScreen goal={goal} />;
}

/** The goals live in Win Zero Plus now: no check-ins here, and no news to show. */
function MovedHome() {
  return (
    <Screen>
      <TopBar right={<LinkButton label="Settings" onPress={() => router.push('/settings')} />} />
      <MovedCard onOpen={openPlus} onStay={() => appStore.getState().keepUsingHere()} />
    </Screen>
  );
}

function HomeScreen({ goal }: { goal: GoalState }) {
  const round = useApp(primaryRound);
  const pick = useApp((s) => s.weapon);
  const selectWeapon = useApp((s) => s.selectWeapon);
  const credits = useApp((s) => s.credits);
  const bonus = useApp((s) => s.bonus);
  const rejection = useApp((s) => s.rejection);
  const clockOffset = useApp((s) => s.devClockOffsetMs); // re-render when the debug clock moves
  const reminderCardHiddenUntil = useApp((s) => s.reminderCardHiddenUntil);
  const moveOut = useApp((s) => s.moveOut);
  const [retrying, setRetrying] = useState(false);
  const reminders = useReminderPermission();
  const { h24, firstWeekday } = useDeviceCalendar();
  const [tick, setTick] = useState(0);

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const today = dayKeyAt(now, tz);
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

  // A move Plus hasn't confirmed: ask about it once it's had time to finish.
  const checkAt = moveCheckAt(moveOut);
  useEffect(() => {
    if (checkAt === null) return;
    const wait = checkAt - appStore.getState().now().getTime();
    if (wait < 0) return;
    const id = setTimeout(() => setTick((t) => t + 1), Math.min(MAX_TIMER_MS, wait + BOUNDARY_SLACK_MS));
    return () => clearTimeout(id);
  }, [checkAt, tick, clockOffset]);

  const retryMove = async () => {
    setRetrying(true);
    await sendMoveOut();
    setRetrying(false);
  };

  // An answer, from the card here or a notification's buttons, leaves a screen to open: the
  // round for Yes, the notice for Not today. Otherwise, on focus and whenever days settle while
  // Home is showing (the app comes back to the foreground, a window closes), catch up and show
  // any Slipping / Reset / Shielded news once. One screen per visit (see routing.ts).
  useFocusEffect(
    useCallback(
      () => startHomeRouting(appStore, (route) => router.push({ pathname: route.path, params: { goal: route.goalId } })),
      [],
    ),
  );

  const onYes = () => {
    feedback.success();
    appStore.getState().answer(goal.goalId, 'yes');
  };

  const onNotToday = () => {
    feedback.soft();
    appStore.getState().answer(goal.goalId, 'not-today');
  };

  const playBonus = () => router.push({ pathname: '/play', params: { round: 'bonus' } });
  const startBonus = (n: number) => {
    if (appStore.getState().startBonusRound(n)) playBonus();
  };

  const banner = rejection ? REJECTED[rejection.reason] : null;
  // It appears after a notification's answer was turned down; say so to a screen reader too.
  useEffect(() => {
    if (banner) AccessibilityInfo.announceForAccessibility(banner);
  }, [banner]);

  const unplayed = round && !round.played ? round : null;
  // Set up after check-in time: until the first answer, say plainly that this question is about today.
  const firstToday = goal.history.length === 0 && pending?.day === goal.firstDay && openedAtSetup(goal);
  const nextWhen = formatWhen(next.opensAt, now, tz, h24);

  return (
    <Screen>
      <TopBar right={<LinkButton label="Settings" onPress={() => router.push('/settings')} />} />

      <View style={styles.goal}>
        <Eyebrow header>Daily goal</Eyebrow>
        <Text style={type.goal}>{goal.goal}</Text>
      </View>

      <Stats goal={goal} today={today} />

      {moveCardFor(moveOut, now) === 'check' ? (
        <MoveCheckCard busy={retrying} onYes={() => confirmMoveByHand()} onRetry={retryMove} onCancel={() => cancelMove()} />
      ) : null}

      {banner ? (
        <Card style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </Card>
      ) : null}

      {unplayed ? (
        <Card>
          <Text style={styles.cardTitle}>Your Day {unplayed.n} round is ready.</Text>
          <Text style={type.lede}>Your rewards are already banked. Play it whenever you like.</Text>
          <Button label="Play now" onPress={() => router.push({ pathname: '/play', params: { goal: goal.goalId } })} />
        </Card>
      ) : null}

      {pending ? (
        <>
          {firstToday ? <Text style={type.lede}>Today counts: your first check-in is open now.</Text> : null}
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
        </>
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

      {remindersCardVisible(reminders.permission, reminderCardHiddenUntil, now) ? (
        <RemindersCard
          denied={reminders.permission === 'denied'}
          checkInTime={formatClockTime(currentCheckInTime(goal), h24)}
          onTurnOn={reminders.turnOn}
          onHide={() => appStore.getState().hideReminderCard()}
        />
      ) : null}

      {goal.paused ? (
        <Fine>Reminders are paused after a long break. Check in whenever you&apos;re ready and they&apos;ll pick back up.</Fine>
      ) : null}

      <CreditsCard goal={goal} credits={credits} bonus={bonus} onStartBonus={startBonus} onPlayBonus={playBonus} />

      <Arsenal goal={goal} pick={pick} onEquip={selectWeapon} />

      <HistoryCalendar
        goal={goal}
        today={today}
        pendingDay={pending?.day ?? null}
        firstWeekday={firstWeekday}
        restDays={FEATURES.schedules}
      />

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
