// Past goals (SPEC 9): the goals archived, newest first, each opening its history. They have no
// reminders and leave their slot free.
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { dayKeyAt } from '@/engine';
import { formatDayShort, plural } from '@/lib/format';
import { appStore, useApp } from '@/store';
import { colors, type } from '@/theme/tokens';
import { Fine, Lede, Row, shared } from '@/ui/bits';
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
  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={leave} />} />
      <Text style={type.h2} accessibilityRole="header">
        {PAST_COPY.title}
      </Text>
      <Lede>{PAST_COPY.lede(maxGoals)}</Lede>
      {newest.length > 0 ? (
        <View style={shared.list}>
          {newest.map(({ goal, archivedAt }) => (
            <Row
              key={goal.goalId}
              label={goal.goal}
              detail={PAST_COPY.detail(formatDayShort(dayKeyAt(new Date(archivedAt), tz)), plural(goal.bestStreak, 'day'))}
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
  call: { ...type.eyebrow, color: colors.amber },
});
