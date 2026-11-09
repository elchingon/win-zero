// Removing a goal (SPEC 9), with one goal or several: archived to Past goals once its best run
// reached ARCHIVE_MIN_BEST zeros, deleted for good before that. Either way it asks first, and what
// it unlocked stays. Without a goal left, Home starts Setup.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ARCHIVE_MIN_BEST, dayKeyAt, goalRemoval, historyStats, type GoalState } from '@/engine';
import { plural } from '@/lib/format';
import { appStore, useApp } from '@/store';
import { colors, space, type } from '@/theme/tokens';
import { Card, Fine } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';

import { ARCHIVE_COPY, DELETE_COPY, LAST_GOAL_COPY } from '../copy';
import { leaveGoal } from '../nav';

export function RemoveGoal({ goal }: { goal: GoalState }) {
  const only = useApp((s) => s.goals.length === 1);
  const [armed, setArmed] = useState(false);
  const archive = goalRemoval(goal) === 'archive';
  const copy = archive ? ARCHIVE_COPY : DELETE_COPY;

  const remove = () => {
    feedback.press();
    const s = appStore.getState();
    if (archive ? s.archiveGoal(goal.goalId) : s.deleteGoal(goal.goalId)) leaveGoal();
  };

  if (!armed) {
    return archive ? (
      <LinkButton label={copy.link} accessibilityHint={copy.hint} onPress={() => setArmed(true)} />
    ) : (
      <View style={styles.offer}>
        <LinkButton label={copy.link} color={colors.flare} accessibilityHint={copy.hint} onPress={() => setArmed(true)} />
        <Fine>{DELETE_COPY.why(ARCHIVE_MIN_BEST)}</Fine>
      </View>
    );
  }
  const store = appStore.getState();
  const { yesDays } = historyStats(goal, dayKeyAt(store.now(), store.timeZone()));
  return (
    <Card style={[styles.confirm, !archive && styles.danger]}>
      <Text style={styles.confirmTitle}>{copy.title(goal.goal)}</Text>
      {archive ? <Fine>{ARCHIVE_COPY.reached(plural(goal.bestStreak, 'day'), plural(yesDays, 'Yes day'))}</Fine> : null}
      <Fine>{copy.body}</Fine>
      {only ? <Fine>{LAST_GOAL_COPY}</Fine> : null}
      <View style={styles.confirmRow}>
        <Button variant={archive ? undefined : 'danger'} label={copy.confirm} onPress={remove} silent style={styles.flex} />
        <Button variant="ghost" label={copy.cancel} onPress={() => setArmed(false)} style={styles.flex} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  offer: { gap: space.xs },
  confirm: { borderColor: colors.line, gap: space.md },
  danger: { borderColor: colors.flare },
  confirmTitle: { ...type.question },
  confirmRow: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
