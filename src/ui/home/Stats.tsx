import { StyleSheet, View } from 'react-native';

import { SHIELD_CAP, type GoalState } from '@/engine';
import { plural } from '@/lib/format';
import { StatTile } from '@/ui/bits';

export function Stats({ goal }: { goal: GoalState }) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <StatTile
          label="Current streak"
          value={String(goal.streak)}
          hero
          accessibilityLabel={`Current streak: ${plural(goal.streak, 'zero')}`}
        />
        <StatTile
          label="Best run"
          value={String(goal.bestStreak)}
          accessibilityLabel={`Best run: ${plural(goal.bestStreak, 'day')}`}
        />
      </View>
      <View style={styles.row}>
        <StatTile label="Bombs" value={String(goal.bombs)} />
        <StatTile
          label="Shields"
          value={`${goal.shields}/${SHIELD_CAP}`}
          accessibilityLabel={`Shields: ${goal.shields} of ${SHIELD_CAP}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
});
