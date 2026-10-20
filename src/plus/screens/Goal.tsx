// One of several goals (SPEC 9): its wording, times, check-in days and lock-screen name.
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { appStore, slotById, useApp } from '@/store';
import { space, type } from '@/theme/tokens';
import { Eyebrow } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { LinkButton } from '@/ui/Button';
import { goalEyebrow } from '@/ui/copy/goals';
import { Screen } from '@/ui/Screen';
import { GoalFields } from '@/ui/settings/GoalFields';
import { useDeviceCalendar } from '@/ui/useDevice';

import { AliasField } from '../goals/AliasField';
import { DaysField } from '../goals/DaysField';
import { leave } from '../nav';

export function Goal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const goal = useApp((s) => (id ? (slotById(s, id)?.goal ?? null) : null));
  const several = useApp((s) => s.goals.length > 1);
  const { firstWeekday } = useDeviceCalendar();
  // A link to a goal that isn't here (an old one): back to Settings. A goal this screen archives
  // goes while it leaves, and that's no reason to redirect.
  const [known] = useState(() => (id ? slotById(appStore.getState(), id) !== null : false));
  useFocusEffect(
    useCallback(() => {
      if (!known) leave();
    }, [known]),
  );

  if (!goal) return null;

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { gap: space.xs },
});
