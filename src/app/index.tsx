// Home: an open check-in or when the next one comes, then the goal, the numbers, credits and the
// bonus round, the arsenal, and the history calendar, with a tip after the first round. Once Win Zero has moved to Win Zero Plus
// (SPEC 9), only where the goals went. Win Zero Plus has its own Home (src/plus/home), with one
// goal or several.
import { Redirect, router } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { currentCheckInTime, dayKeyAt, isEveryDay, nextWindow, openedAtSetup, pendingWindow, type GoalState } from '@/engine';
import type { Point } from '@/game/yes';
import { formatClockTime, formatWhen } from '@/lib/format';
import {
  appStore,
  arsenalBestOf,
  arsenalStreakOf,
  gameModeOf,
  isMovedOut,
  primaryGoal,
  primaryRound,
  useApp,
} from '@/store';
import { cancelMove, confirmMoveByHand, openPlus, openPlusStore, sendMoveOut } from '@/transfer/send';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { LinkButton } from '@/ui/Button';
import { yesCelebration } from '@/ui/celebrate';
import { goalEyebrow } from '@/ui/copy/goals';
import { feedback } from '@/ui/feedback';
import { Arsenal } from '@/ui/home/Arsenal';
import { CheckInCard } from '@/ui/home/CheckInCard';
import { CreditsCard } from '@/ui/home/CreditsCard';
import { Celebrations } from '@/ui/home/Celebrations';
import { FirstRoundTip } from '@/ui/home/FirstRoundTip';
import { HistoryCalendar } from '@/ui/home/HistoryCalendar';
import { moveCardFor, moveCheckAt } from '@/ui/home/moved';
import { MoveCheckCard, MovedCard } from '@/ui/home/MovedCard';
import { PlusPromoCard, PlusPromoToggle } from '@/ui/home/PlusPromo';
import { ReadyRoundCard } from '@/ui/home/ReadyRoundCard';
import { RejectionBanner } from '@/ui/home/RejectionBanner';
import { RemindersCard } from '@/ui/home/RemindersCard';
import { remindersCardVisible } from '@/ui/home/remindersOff';
import { Stats } from '@/ui/home/Stats';
import { BOUNDARY_SLACK_MS, MAX_TIMER_MS, useBoundaryRefresh } from '@/ui/home/useBoundaryRefresh';
import { useHomeRouting } from '@/ui/home/useHomeRouting';
import { Screen } from '@/ui/Screen';
import { useDeviceCalendar } from '@/ui/useDevice';
import { useReminderPermission } from '@/ui/useReminderPermission';
import { FEATURES, PLUS_OFFERED } from '@/variant';

// Development builds only: Metro folds __DEV__ to false in production and drops the require.
const DemoControls: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/DebugSection').DemoControls
  : null;

// Win Zero Plus only: the literal comparison folds per file, so Win Zero's bundle leaves it out.
const PlusHome: ComponentType | null =
  process.env.EXPO_PUBLIC_APP_VARIANT === 'plus'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/plus/home/PlusHome').PlusHome
    : null;

export default function Home() {
  const goal = useApp(primaryGoal);
  const moved = useApp(isMovedOut);
  if (!goal) return <Redirect href="/setup" />;
  if (moved) return <MovedHome />;
  if (PlusHome) return <PlusHome />;
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
  // The arsenal and credits are shared by every goal (SPEC 9): with one goal, these are its own.
  const best = useApp(arsenalBestOf);
  const streak = useApp(arsenalStreakOf);
  const pick = useApp((s) => s.weapon);
  const mode = useApp(gameModeOf);
  const selectWeapon = useApp((s) => s.selectWeapon);
  const credits = useApp((s) => s.credits);
  const bonus = useApp((s) => s.bonus);
  const reminderCardHiddenUntil = useApp((s) => s.reminderCardHiddenUntil);
  const moveOut = useApp((s) => s.moveOut);
  const [retrying, setRetrying] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const reminders = useReminderPermission();
  const { h24, firstWeekday } = useDeviceCalendar();

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const today = dayKeyAt(now, tz);
  const pending = pendingWindow(goal, now);
  const next = nextWindow(goal);

  // Show the card the moment a window opens, and settle it the moment it closes.
  const { tick, clockOffset, bump } = useBoundaryRefresh((pending ? pending.closesAt : next.opensAt).getTime());

  // A move Plus hasn't confirmed: ask about it once it's had time to finish.
  const checkAt = moveCheckAt(moveOut);
  useEffect(() => {
    if (checkAt === null) return;
    const wait = checkAt - appStore.getState().now().getTime();
    if (wait < 0) return;
    const id = setTimeout(bump, Math.min(MAX_TIMER_MS, wait + BOUNDARY_SLACK_MS));
    return () => clearTimeout(id);
  }, [checkAt, tick, clockOffset, bump]);

  const retryMove = async () => {
    setRetrying(true);
    await sendMoveOut();
    setRetrying(false);
  };

  useHomeRouting();

  // The celebration plays the Yes's chime and haptic as the round opens.
  const onYes = (at: Point | null) => {
    yesCelebration.armed(at, () => appStore.getState().answer(goal.goalId, 'yes'));
  };

  const onNotToday = () => {
    feedback.soft();
    appStore.getState().answer(goal.goalId, 'not-today');
  };

  const playBonus = () => router.push({ pathname: '/play', params: { round: 'bonus' } });
  const startBonus = (n: number) => {
    if (appStore.getState().startBonusRound(n)) playBonus();
  };

  const unplayed = round && !round.played ? round : null;
  // Set up after check-in time: until the first answer, say plainly that this question is about today.
  const firstToday = goal.history.length === 0 && pending?.day === goal.firstDay && openedAtSetup(goal);
  const nextWhen = formatWhen(next.opensAt, now, tz, h24);

  return (
    <Screen>
      <TopBar right={<LinkButton label="Settings" onPress={() => router.push('/settings')} />} />

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

      <View style={styles.goal}>
        <View style={styles.goalHead}>
          <Eyebrow header>{goalEyebrow(goal, firstWeekday)}</Eyebrow>
          {PLUS_OFFERED ? <PlusPromoToggle open={plusOpen} onPress={() => setPlusOpen((was) => !was)} /> : null}
        </View>
        <Text style={type.goal}>{goal.goal}</Text>
      </View>

      {PLUS_OFFERED && plusOpen ? <PlusPromoCard onGet={openPlusStore} onMove={() => router.push('/move')} /> : null}

      <Stats goal={goal} today={today} />

      {moveCardFor(moveOut, now) === 'check' ? (
        <MoveCheckCard busy={retrying} onYes={() => confirmMoveByHand()} onRetry={retryMove} onCancel={() => cancelMove()} />
      ) : null}

      <RejectionBanner />

      {unplayed ? <ReadyRoundCard round={unplayed} goalId={goal.goalId} /> : null}

      {remindersCardVisible(reminders.permission, reminderCardHiddenUntil, now) ? (
        <RemindersCard
          denied={reminders.permission === 'denied'}
          // A goal on chosen days (Win Zero Plus) isn't asked about "each day".
          checkInTime={isEveryDay(goal) ? formatClockTime(currentCheckInTime(goal), h24) : null}
          onTurnOn={reminders.turnOn}
          onHide={() => appStore.getState().hideReminderCard()}
        />
      ) : null}

      {goal.paused ? (
        <Fine>Reminders are paused after a long break. Check in whenever you&apos;re ready and they&apos;ll pick back up.</Fine>
      ) : null}

      <CreditsCard best={best} credits={credits} bonus={bonus} onStartBonus={startBonus} onPlayBonus={playBonus} />

      <Arsenal best={best} streak={streak} pick={pick} onEquip={selectWeapon} mode={mode} />

      <HistoryCalendar
        goal={goal}
        today={today}
        pendingDay={pending?.day ?? null}
        firstWeekday={firstWeekday}
        restDays={FEATURES.schedules}
      />

      {DemoControls ? <DemoControls /> : null}

      <FirstRoundTip />
      <Celebrations />
    </Screen>
  );
}

const styles = StyleSheet.create({
  goal: { gap: space.xs },
  goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
});
