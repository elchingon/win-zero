// Settings › Goals (SPEC 9): adding a goal, under any goals listed above it.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/store';
import { colors, type } from '@/theme/tokens';
import { Eyebrow, Row, shared } from '@/ui/bits';

import { GOALS_COPY } from '../copy';

export function GoalsGroup({ children }: { children?: ReactNode }) {
  const count = useApp((s) => s.goals.length);
  const maxGoals = useApp((s) => s.limits.maxGoals);
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
            hint="Opens a new goal to fill in"
            onPress={() => router.push('/add-goal')}
          />
        ) : (
          <Row label={GOALS_COPY.add} detail={GOALS_COPY.full(maxGoals)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  call: { ...type.eyebrow, color: colors.amber },
});
