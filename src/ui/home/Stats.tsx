// Home's numbers: the streak, the best run (and when it was), Yes days in all and this month,
// bombs and shields, and any more the app adds (Win Zero Plus: comebacks).
import { StyleSheet, View } from 'react-native';

import { historyStats, SHIELD_CAP, type DayKey, type GoalState } from '@/engine';
import { formatDayRange, plural } from '@/lib/format';
import { StatTile } from '@/ui/bits';

/** A tile of its own, after the others. */
export interface ExtraStat {
  label: string;
  value: string;
  caption?: string;
}

export function Stats({ goal, today, extra = [] }: { goal: GoalState; today: DayKey; extra?: readonly ExtraStat[] }) {
  const { yesDays, yesThisMonth, bestRun } = historyStats(goal, today);
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
          caption={bestRun ? formatDayRange(bestRun.from, bestRun.to, today) : undefined}
          accessibilityLabel={`Best run: ${plural(goal.bestStreak, 'day')}${
            bestRun ? `, ${formatDayRange(bestRun.from, bestRun.to, today, ' to ')}` : ''
          }`}
        />
      </View>
      <View style={styles.row}>
        <StatTile label="Yes days" value={String(yesDays)} accessibilityLabel={`Yes days: ${yesDays}`} />
        <StatTile
          label="Yes this month"
          value={String(yesThisMonth)}
          accessibilityLabel={`Yes days this month: ${yesThisMonth}`}
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
      {extra.length > 0 ? (
        <View style={styles.row}>
          {extra.map((x) => (
            <StatTile key={x.label} label={x.label} value={x.value} caption={x.caption} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
});
