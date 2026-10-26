// One past goal (SPEC 9): read-only, its numbers and history as they were when it was archived.
// Delete for good is offered here and nowhere else, and asks first. Weapons and themes it
// unlocked stay (the store keeps its best in arsenalBest).
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dayKeyAt } from '@/engine';
import { formatDayShort } from '@/lib/format';
import { appStore, useApp } from '@/store';
import { colors, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { HistoryCalendar } from '@/ui/home/HistoryCalendar';
import { Stats } from '@/ui/home/Stats';
import { Screen } from '@/ui/Screen';
import { useDeviceCalendar } from '@/ui/useDevice';

import { PAST_COPY } from '../copy';
import { leave } from '../nav';

export function PastGoal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const past = useApp((s) => s.archived.find((a) => a.goal.goalId === id) ?? null);
  const { firstWeekday } = useDeviceCalendar();
  const [armed, setArmed] = useState(false);
  // A link to a past goal that isn't here: back to Settings. One this screen deletes goes while
  // it leaves, and that's no reason to redirect.
  const [known] = useState(() => appStore.getState().archived.some((a) => a.goal.goalId === id));
  useFocusEffect(
    useCallback(() => {
      if (!known) leave();
    }, [known]),
  );

  if (!past) return null;
  const { goal } = past;
  // Its calendar ends the day it was archived: no rest days, or anything else, after that.
  const archivedDay = dayKeyAt(new Date(past.archivedAt), appStore.getState().timeZone());

  const remove = () => {
    feedback.press();
    const s = appStore.getState();
    if (!s.deleteArchivedGoal(goal.goalId)) return;
    if (appStore.getState().archived.length > 0) leave();
    else router.dismissTo('/settings');
  };

  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={leave} />} />
      <View style={styles.title}>
        <Eyebrow>{PAST_COPY.archived(formatDayShort(archivedDay))}</Eyebrow>
        <Text style={type.goal} accessibilityRole="header">
          {goal.goal}
        </Text>
      </View>
      <Stats goal={goal} today={archivedDay} />
      <HistoryCalendar goal={goal} today={archivedDay} pendingDay={null} firstWeekday={firstWeekday} restDays />
      {armed ? (
        <Card style={styles.confirm}>
          <Text style={styles.confirmTitle}>{PAST_COPY.deleteTitle(goal.goal)}</Text>
          <Fine>{PAST_COPY.deleteBody}</Fine>
          <View style={styles.confirmRow}>
            <Button variant="danger" label={PAST_COPY.deleteConfirm} onPress={remove} silent style={styles.flex} />
            <Button variant="ghost" label={PAST_COPY.deleteCancel} onPress={() => setArmed(false)} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <LinkButton
          label={PAST_COPY.deleteLink}
          color={colors.flare}
          accessibilityHint={PAST_COPY.deleteHint}
          onPress={() => setArmed(true)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { gap: space.xs },
  confirm: { borderColor: colors.flare, gap: space.md },
  confirmTitle: { ...type.question },
  confirmRow: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
