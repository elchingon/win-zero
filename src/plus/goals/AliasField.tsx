// A goal's lock-screen name (SPEC 9): with "Goal in reminders" off and several goals, reminders call
// the goal by it instead of its place ("your second goal"), which is what it shows until one is set.
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { GOAL_ALIAS_MAX_LENGTH, type GoalState } from '@/engine';
import { goalLabel } from '@/notifications/schedule';
import { appStore, useApp } from '@/store';
import { space } from '@/theme/tokens';
import { Field, TextField } from '@/ui/bits';
import { Button } from '@/ui/Button';

import { GOAL_COPY } from '../copy';

/** Key it by the goal's id: the name being typed belongs to one goal. */
export function AliasField({ goal }: { goal: GoalState }) {
  const place = useApp((s) => s.goals.findIndex((slot) => slot.goal.goalId === goal.goalId));
  const count = useApp((s) => s.goals.length);
  const [draft, setDraft] = useState(goal.alias ?? '');
  const [saved, setSaved] = useState(false);
  const changed = draft.trim() !== (goal.alias ?? '');
  const { alias: _named, ...unnamed } = goal;
  // What reminders call it without a name: its place among the goals.
  const byPlace = goalLabel(unnamed, place, count, false);

  const save = () => {
    if (!appStore.getState().setGoalAlias(goal.goalId, draft).ok) return;
    setDraft(draft.trim().slice(0, GOAL_ALIAS_MAX_LENGTH).trim());
    setSaved(true);
    AccessibilityInfo.announceForAccessibility(GOAL_COPY.aliasSaved);
  };

  return (
    <View style={styles.block}>
      <Field label={GOAL_COPY.aliasLabel} hint={saved ? GOAL_COPY.aliasSaved : GOAL_COPY.aliasHint}>
        <TextField
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            setSaved(false);
          }}
          placeholder={byPlace}
          maxLength={GOAL_ALIAS_MAX_LENGTH}
          returnKeyType="done"
          onSubmitEditing={() => changed && save()}
          accessibilityLabel={GOAL_COPY.aliasLabel}
        />
      </Field>
      {changed ? (
        <Button small label={draft.trim() ? GOAL_COPY.aliasSave : GOAL_COPY.aliasClear} onPress={save} style={styles.start} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
});
