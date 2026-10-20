// Settings › Goals with several goals (SPEC 9): each goal's days and check-in time, opening its own
// screen, then adding another.
import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { checkInDays, currentCheckInTime } from '@/engine';
import { formatClockTime, formatDays } from '@/lib/format';
import { useApp } from '@/store';
import { colors, type } from '@/theme/tokens';
import { Row } from '@/ui/bits';
import { useDeviceCalendar } from '@/ui/useDevice';

import { GOAL_COPY } from '../copy';
import { GoalsGroup } from './GoalsGroup';

export function GoalsList() {
  const slots = useApp((s) => s.goals);
  const { h24, firstWeekday } = useDeviceCalendar();
  return (
    <GoalsGroup>
      {slots.map(({ goal }) => (
        <Row
          key={goal.goalId}
          label={goal.goal}
          detail={`${formatDays(checkInDays(goal), firstWeekday)} · ${formatClockTime(currentCheckInTime(goal), h24)}`}
          right={<Text style={styles.call}>{GOAL_COPY.edit}</Text>}
          hint={GOAL_COPY.rowHint}
          onPress={() => router.push({ pathname: '/goal', params: { id: goal.goalId } })}
        />
      ))}
    </GoalsGroup>
  );
}

const styles = StyleSheet.create({
  call: { ...type.eyebrow, color: colors.amber },
});
