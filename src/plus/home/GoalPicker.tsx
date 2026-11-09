// Which goal's numbers and history calendar Win Zero Plus's Home shows (SPEC 9): one chip per
// goal, read out as radios under a visible heading (a screen reader doesn't read a group's label).
// Beside the heading, Add goal while there's room for another, and Past goals once there are some.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { GoalSlot } from '@/store';
import { colors, space } from '@/theme/tokens';
import { Eyebrow, shared } from '@/ui/bits';
import { feedback } from '@/ui/feedback';

import { GOALS_COPY, HOME_COPY, PAST_COPY } from '../copy';
import { CallButton } from '../ui/CallButton';

export function GoalPicker(props: {
  slots: readonly GoalSlot[];
  picked: string;
  onPick: (goalId: string) => void;
  /** Opens Add a goal; left out when the goals are full. */
  onAdd?: () => void;
  /** Opens Past goals; left out while there are none. */
  onPast?: () => void;
}) {
  const { slots, picked, onPick, onAdd, onPast } = props;
  return (
    <View style={shared.section}>
      <View style={shared.sectionHead}>
        <Eyebrow header>{HOME_COPY.yourGoals}</Eyebrow>
        <View style={styles.calls}>
          {onPast ? <CallButton label={PAST_COPY.title} accessibilityHint={PAST_COPY.openHint} onPress={onPast} /> : null}
          {onAdd ? <CallButton label={HOME_COPY.addGoal} accessibilityHint={GOALS_COPY.addHint} onPress={onAdd} /> : null}
        </View>
      </View>
      <View style={shared.chips} accessibilityRole="radiogroup">
        {slots.map(({ goal }) => {
          const on = goal.goalId === picked;
          return (
            <Pressable
              key={goal.goalId}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={goal.goal}
              accessibilityHint={on ? undefined : HOME_COPY.pickHint}
              onPress={() => {
                if (on) return;
                feedback.tick();
                onPick(goal.goalId);
              }}
              style={({ pressed }) => [shared.chipTarget, pressed && !on && { opacity: 0.7 }]}
            >
              <View style={[shared.chip, on && shared.chipOn]}>
                <Text style={[shared.chipLabel, on && { color: colors.amber }]}>{goal.goal}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calls: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: space.lg },
});
