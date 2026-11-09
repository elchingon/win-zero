// What a past goal accomplished (SPEC 9), on its Past goals page: its best run first, then its Yes
// days (a head start's among them), check-ins, comebacks and shields used, how long it ran, and the
// milestones its best run reached. Every number comes from the engine.
import { StyleSheet, Text, View } from 'react-native';

import { goalAccomplishments, MILESTONES, type DayKey, type GoalState } from '@/engine';
import { formatDayRange, joinAnd, plural } from '@/lib/format';
import { colors, fonts, space } from '@/theme/tokens';
import { Eyebrow, StatTile } from '@/ui/bits';

import { PAST_COPY } from '../copy';

const S = PAST_COPY.stats;

export function Accomplishments({ goal, lastDay }: { goal: GoalState; lastDay: DayKey }) {
  const a = goalAccomplishments(goal, lastDay);
  const run = a.bestRun ? formatDayRange(a.bestRun.from, a.bestRun.to, lastDay) : undefined;
  const runSpoken = a.bestRun ? `, ${formatDayRange(a.bestRun.from, a.bestRun.to, lastDay, ' to ')}` : '';
  const span = formatDayRange(a.firstDay, a.lastDay, lastDay);
  const day = (n: number) => `Day ${n}`;
  const rest = MILESTONES.filter((m) => !a.milestones.includes(m));
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <StatTile
          label={S.bestRun}
          value={String(a.bestStreak)}
          hero
          caption={run}
          accessibilityLabel={`${S.bestRun}: ${plural(a.bestStreak, 'day')}${runSpoken}`}
        />
        <StatTile
          label={S.yesDays}
          value={String(a.yesDays)}
          caption={a.headStartDays > 0 ? S.headStart(a.headStartDays) : undefined}
        />
      </View>
      <View style={styles.row}>
        <StatTile label={S.answered} value={String(a.answered)} />
        <StatTile label={S.comebacks} value={String(a.comebacks)} />
      </View>
      <View style={styles.row}>
        <StatTile label={S.shieldsUsed} value={String(a.shieldsUsed)} />
        <StatTile label={S.days} value={String(a.days)} caption={span} />
      </View>
      <View
        style={styles.milestones}
        accessible
        accessibilityLabel={`${PAST_COPY.milestones}: ${PAST_COPY.milestonesSpoken(joinAnd(a.milestones.map(day)), joinAnd(rest.map(day)))}`}
      >
        <Eyebrow>{PAST_COPY.milestones}</Eyebrow>
        <View style={styles.badges}>
          {MILESTONES.map((m) => {
            const on = a.milestones.includes(m);
            return (
              <View key={m} style={[styles.badge, on && styles.badgeOn]}>
                <Text style={[styles.badgeText, on && styles.badgeTextOn]}>{m}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  milestones: { gap: space.sm, marginTop: space.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.edge,
    alignItems: 'center',
  },
  badgeOn: { borderColor: colors.amber, backgroundColor: colors.panel },
  badgeText: { fontFamily: fonts.mono, fontSize: 14, color: colors.muted },
  badgeTextOn: { fontFamily: fonts.monoSemiBold, color: colors.amber },
});
