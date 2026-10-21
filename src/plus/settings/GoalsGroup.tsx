// Settings › Goals (SPEC 9): adding a goal, under any goals listed above it, and the past goals.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/store';
import { colors, type } from '@/theme/tokens';
import { Eyebrow, Row, shared } from '@/ui/bits';

import { GOALS_COPY, PAST_COPY } from '../copy';

export function GoalsGroup({ children }: { children?: ReactNode }) {
  const count = useApp((s) => s.goals.length);
  const maxGoals = useApp((s) => s.limits.maxGoals);
  const past = useApp((s) => s.archived.length);
  const room = maxGoals - count;
  return (
    <View style={shared.section}>
      <Eyebrow header>{GOALS_COPY.title}</Eyebrow>
      <View style={shared.list}>
        {children}
        {room > 0 ? (
          <Row
            label={GOALS_COPY.add}
            detail={count > 1 ? GOALS_COPY.addMore(room) : GOALS_COPY.addDetail(maxGoals)}
            right={<Text style={styles.call}>Add</Text>}
            hint={GOALS_COPY.addHint}
            onPress={() => router.push('/add-goal')}
          />
        ) : (
          <Row label={GOALS_COPY.add} detail={GOALS_COPY.full(maxGoals)} />
        )}
        {past > 0 ? (
          <Row
            label={PAST_COPY.title}
            detail={PAST_COPY.count(past)}
            right={<Text style={styles.call}>{PAST_COPY.view}</Text>}
            hint="Opens the goals you've archived"
            onPress={() => router.push('/past-goals')}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  call: { ...type.eyebrow, color: colors.amber },
});
