// Past goals (SPEC 9): what the archived goals accomplished, added up, then each goal, newest first,
// opening its own numbers and history. They have no reminders and leave their slot free.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { accomplishmentTotals, dayKeyAt, historyStats } from '@/engine';
import { formatDayShort, plural } from '@/lib/format';
import { appStore, useApp } from '@/store';
import { colors, type } from '@/theme/tokens';
import { Fine, Lede, Row, shared, StatTile } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { LinkButton } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

import { PAST_COPY } from '../copy';
import { leave } from '../nav';

export function PastGoals() {
  const archived = useApp((s) => s.archived);
  const maxGoals = useApp((s) => s.limits.maxGoals);
  const tz = appStore.getState().timeZone();
  const newest = [...archived].sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  const totals = accomplishmentTotals(archived.map((a) => a.goal));
  const T = PAST_COPY.totals;
  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={leave} />} />
      <Text style={type.h2} accessibilityRole="header">
        {PAST_COPY.title}
      </Text>
      <Lede>{PAST_COPY.lede(maxGoals)}</Lede>
      {newest.length > 0 ? (
        <View style={styles.grid}>
          <View style={styles.row}>
            <StatTile label={T.goals} value={String(totals.goals)} />
            <StatTile label={T.yesDays} value={String(totals.yesDays)} />
          </View>
          <View style={styles.row}>
            <StatTile
              label={T.bestRun}
              value={String(totals.bestStreak)}
              accessibilityLabel={`${T.bestRun}: ${plural(totals.bestStreak, 'day')}`}
            />
            <StatTile label={T.comebacks} value={String(totals.comebacks)} />
          </View>
        </View>
      ) : null}
      {newest.length > 0 ? (
        <View style={shared.list}>
          {newest.map(({ goal, archivedAt }) => (
            <Row
              key={goal.goalId}
              label={goal.goal}
              detail={PAST_COPY.detail(
                plural(goal.bestStreak, 'day'),
                plural(historyStats(goal, goal.firstDay).yesDays, 'Yes day'),
                formatDayShort(dayKeyAt(new Date(archivedAt), tz)),
              )}
              right={<Text style={styles.call}>{PAST_COPY.view}</Text>}
              hint={PAST_COPY.rowHint}
              onPress={() => router.push({ pathname: '/past-goal', params: { id: goal.goalId } })}
            />
          ))}
        </View>
      ) : (
        <Fine>{PAST_COPY.none}</Fine>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  call: { ...type.eyebrow, color: colors.amber },
});
