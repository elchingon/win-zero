// Win Zero Plus's Home with several goals (SPEC 9): rounds ready to play, then the open check-ins
// (the one that opened first, first), then when the others check in next. The credits and the
// arsenal are shared; a picker chooses whose numbers and history calendar show. With one goal,
// Home is Win Zero's (src/app/index.tsx).
import { router } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dayKeyAt, openedAtSetup } from '@/engine';
import { formatWhen } from '@/lib/format';
import { appStore, arsenalBestOf, arsenalStreakOf, gameModeOf, useApp } from '@/store';
import { colors, fonts, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { LinkButton } from '@/ui/Button';
import { goalEyebrow } from '@/ui/copy/goals';
import { feedback } from '@/ui/feedback';
import { Arsenal } from '@/ui/home/Arsenal';
import { CheckInCard } from '@/ui/home/CheckInCard';
import { CreditsCard } from '@/ui/home/CreditsCard';
import { HistoryCalendar } from '@/ui/home/HistoryCalendar';
import { ReadyRoundCard } from '@/ui/home/ReadyRoundCard';
import { RejectionBanner } from '@/ui/home/RejectionBanner';
import { RemindersCard } from '@/ui/home/RemindersCard';
import { remindersCardVisible } from '@/ui/home/remindersOff';
import { Stats } from '@/ui/home/Stats';
import { useBoundaryRefresh } from '@/ui/home/useBoundaryRefresh';
import { useHomeRouting } from '@/ui/home/useHomeRouting';
import { Screen } from '@/ui/Screen';
import { useDeviceCalendar } from '@/ui/useDevice';
import { useReminderPermission } from '@/ui/useReminderPermission';
import { FEATURES } from '@/variant';

import { HOME_COPY } from '../copy';
import { GoalPicker } from './GoalPicker';
import { homeCards } from './order';

// Development builds only: Metro folds __DEV__ to false in production and drops the require.
const DemoControls: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/DebugSection').DemoControls
  : null;

export function MultiGoalHome() {
  const slots = useApp((s) => s.goals);
  const best = useApp(arsenalBestOf);
  const streak = useApp(arsenalStreakOf);
  const pick = useApp((s) => s.weapon);
  const mode = useApp(gameModeOf);
  const selectWeapon = useApp((s) => s.selectWeapon);
  const credits = useApp((s) => s.credits);
  const bonus = useApp((s) => s.bonus);
  const reminderCardHiddenUntil = useApp((s) => s.reminderCardHiddenUntil);
  const reminders = useReminderPermission();
  const { h24, firstWeekday } = useDeviceCalendar();
  const [picked, setPicked] = useState<string | null>(null);

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const today = dayKeyAt(now, tz);
  const { ready, open, later, boundary } = homeCards(slots, now);

  // Show a card the moment its window opens, and settle it the moment it closes.
  useBoundaryRefresh(boundary);
  useHomeRouting();

  const answer = (goalId: string, yes: boolean) => {
    if (yes) feedback.success();
    else feedback.soft();
    appStore.getState().answer(goalId, yes ? 'yes' : 'not-today');
  };

  const playBonus = () => router.push({ pathname: '/play', params: { round: 'bonus' } });
  const startBonus = (n: number) => {
    if (appStore.getState().startBonusRound(n)) playBonus();
  };

  // The goal whose numbers show: the one picked, while it's here, or the first.
  const shown = slots.find((s) => s.goal.goalId === picked) ?? slots[0];
  if (!shown) return null;
  const shownPending = open.find((o) => o.slot === shown)?.window ?? null;

  return (
    <Screen>
      <TopBar right={<LinkButton label="Settings" onPress={() => router.push('/settings')} />} />

      <RejectionBanner named />

      {ready.map(({ goal, round }) =>
        round ? <ReadyRoundCard key={goal.goalId} round={round} goalId={goal.goalId} goalName={goal.goal} /> : null,
      )}

      {open.map(({ slot: { goal }, window }) => (
        <View key={`${goal.goalId}:${window.day}`} style={styles.checkIn}>
          {goal.history.length === 0 && window.day === goal.firstDay && openedAtSetup(goal) ? (
            <Text style={type.lede}>Today counts: your first check-in is open now.</Text>
          ) : null}
          <CheckInCard
            goal={goal}
            window={window}
            now={now}
            tz={tz}
            h24={h24}
            onYes={() => answer(goal.goalId, true)}
            onNotToday={() => answer(goal.goalId, false)}
          />
        </View>
      ))}

      {later.length > 0 ? (
        <Card>
          <Text style={styles.cardTitle}>{open.length === 0 ? HOME_COPY.caughtUp : HOME_COPY.upNext}</Text>
          {later.map(({ slot: { goal }, next }) => (
            <Text key={goal.goalId} style={type.lede}>
              {HOME_COPY.nextCheckIn(goal.goal, formatWhen(next.opensAt, now, tz, h24))}
            </Text>
          ))}
        </Card>
      ) : null}

      {remindersCardVisible(reminders.permission, reminderCardHiddenUntil, now) ? (
        <RemindersCard
          denied={reminders.permission === 'denied'}
          checkInTime={null}
          onTurnOn={reminders.turnOn}
          onHide={() => appStore.getState().hideReminderCard()}
        />
      ) : null}

      {slots
        .filter((s) => s.goal.paused)
        .map(({ goal }) => (
          <Fine key={goal.goalId}>{HOME_COPY.paused(goal.goal)}</Fine>
        ))}

      <CreditsCard best={best} credits={credits} bonus={bonus} onStartBonus={startBonus} onPlayBonus={playBonus} />

      <Arsenal best={best} streak={streak} pick={pick} onEquip={selectWeapon} mode={mode} />

      <GoalPicker slots={slots} picked={shown.goal.goalId} onPick={setPicked} />

      <View style={styles.goal}>
        <Eyebrow>{goalEyebrow(shown.goal, firstWeekday)}</Eyebrow>
        <Text style={type.goal}>{shown.goal.goal}</Text>
      </View>

      <Stats goal={shown.goal} today={today} />

      <HistoryCalendar
        key={shown.goal.goalId}
        goal={shown.goal}
        today={today}
        pendingDay={shownPending?.day ?? null}
        firstWeekday={firstWeekday}
        restDays={FEATURES.schedules}
      />

      {DemoControls ? <DemoControls /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  checkIn: { gap: space.xxl },
  goal: { gap: space.xs },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.fg },
});
