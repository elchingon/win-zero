// Changing a running goal's check-in days (SPEC 9). The change starts from the next check-in day
// that hasn't opened (the engine decides which), so it never rewrites a day that's settled or
// closes an open window early; while it waits, the field says when it starts.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { checkInDays, dayKeyAt, type GoalState, type ScheduleEntry, type Weekday } from '@/engine';
import { relativeDay } from '@/lib/format';
import { appStore } from '@/store';
import { space } from '@/theme/tokens';
import { Fine } from '@/ui/bits';
import { Button } from '@/ui/Button';

import { DAYS_COPY } from '../copy';
import { ChooseDays } from './WeekdayPicker';

const sameDays = (a: readonly number[], b: readonly number[]) => a.join() === b.join();
const daysOf = (entry: ScheduleEntry | undefined): readonly number[] => entry?.days ?? [0, 1, 2, 3, 4, 5, 6];

/** The day a change of days still waiting starts, or null when the latest days are already in force. */
function waitingFrom(goal: GoalState, today: string): string | null {
  const entries = goal.checkInSchedule;
  const latest = entries.at(-1);
  const before = entries.at(-2);
  if (!latest || !before || latest.fromDay < today || sameDays(daysOf(latest), daysOf(before))) return null;
  return latest.fromDay;
}

export function DaysField({ goal }: { goal: GoalState }) {
  const current = checkInDays(goal);
  const [draft, setDraft] = useState<Weekday[]>([...current]);
  const store = appStore.getState();
  const today = dayKeyAt(store.now(), store.timeZone());
  const from = waitingFrom(goal, today);
  const changed = !sameDays(draft, current);

  return (
    <View style={styles.block}>
      <ChooseDays days={draft} onChange={setDraft} hint={DAYS_COPY.changeHint} />
      {from ? <Fine>{DAYS_COPY.starts(relativeDay(from, today))}</Fine> : null}
      {changed ? (
        <Button
          small
          label={DAYS_COPY.save}
          onPress={() => appStore.getState().setCheckInDays(goal.goalId, draft)}
          style={styles.start}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  start: { alignSelf: 'flex-start' },
});
