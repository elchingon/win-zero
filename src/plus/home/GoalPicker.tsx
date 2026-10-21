// Which goal's numbers and history calendar Win Zero Plus's Home shows (SPEC 9): one chip per
// goal, read out as radios under a visible heading (a screen reader doesn't read a group's label).
// Beside the heading, Add goal while there's room for another.
import { Pressable, Text, View } from 'react-native';

import type { GoalSlot } from '@/store';
import { colors } from '@/theme/tokens';
import { Eyebrow, shared } from '@/ui/bits';
import { feedback } from '@/ui/feedback';

import { GOALS_COPY, HOME_COPY } from '../copy';
import { CallButton } from '../ui/CallButton';

export function GoalPicker(props: {
  slots: readonly GoalSlot[];
  picked: string;
  onPick: (goalId: string) => void;
  /** Opens Add a goal; left out when the goals are full. */
  onAdd?: () => void;
}) {
  const { slots, picked, onPick, onAdd } = props;
  return (
    <View style={shared.section}>
      <View style={shared.sectionHead}>
        <Eyebrow header>{HOME_COPY.yourGoals}</Eyebrow>
        {onAdd ? <CallButton label={HOME_COPY.addGoal} accessibilityHint={GOALS_COPY.addHint} onPress={onAdd} /> : null}
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
