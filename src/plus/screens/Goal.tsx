// One of several goals (SPEC 9): its wording, times, check-in days and lock-screen name, and
// archiving it, which asks first. Its history then waits under Past goals.
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { appStore, slotById, useApp } from '@/store';
import { colors, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Fine } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { goalEyebrow } from '@/ui/copy/goals';
import { Screen } from '@/ui/Screen';
import { GoalFields } from '@/ui/settings/GoalFields';
import { useDeviceCalendar } from '@/ui/useDevice';

import { ARCHIVE_COPY } from '../copy';
import { AliasField } from '../goals/AliasField';
import { DaysField } from '../goals/DaysField';
import { leave } from '../nav';

export function Goal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goal = useApp((s) => (id ? (slotById(s, id)?.goal ?? null) : null));
  const several = useApp((s) => s.goals.length > 1);
  const { firstWeekday } = useDeviceCalendar();
  const [armed, setArmed] = useState(false);
  // A link to a goal that isn't here (an old one): back to Settings. A goal this screen archives
  // goes while it leaves, and that's no reason to redirect.
  const [known] = useState(() => (id ? slotById(appStore.getState(), id) !== null : false));
  useFocusEffect(
    useCallback(() => {
      if (!known) leave();
    }, [known]),
  );

  if (!goal) return null;

  const archive = () => {
    feedback.press();
    if (appStore.getState().archiveGoal(goal.goalId)) leave();
  };

  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={leave} />} />
      <View style={styles.title}>
        <Eyebrow>{goalEyebrow(goal, firstWeekday)}</Eyebrow>
        <Text style={type.goal} accessibilityRole="header">
          {goal.goal}
        </Text>
      </View>
      <GoalFields key={goal.goalId} goal={goal} />
      <DaysField key={`${goal.goalId}-days`} goal={goal} />
      {several ? <AliasField key={`${goal.goalId}-alias`} goal={goal} /> : null}
      {several && armed ? (
        <Card style={styles.confirm}>
          <Text style={styles.confirmTitle}>{ARCHIVE_COPY.title(goal.goal)}</Text>
          <Fine>{ARCHIVE_COPY.body}</Fine>
          <View style={styles.confirmRow}>
            <Button label={ARCHIVE_COPY.confirm} onPress={archive} silent style={styles.flex} />
            <Button variant="ghost" label={ARCHIVE_COPY.cancel} onPress={() => setArmed(false)} style={styles.flex} />
          </View>
        </Card>
      ) : several ? (
        <LinkButton label={ARCHIVE_COPY.link} accessibilityHint={ARCHIVE_COPY.hint} onPress={() => setArmed(true)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { gap: space.xs },
  confirm: { borderColor: colors.line, gap: space.md },
  confirmTitle: { ...type.question },
  confirmRow: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
