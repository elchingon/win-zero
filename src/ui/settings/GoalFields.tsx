// A goal's wording and times in Settings, changed through the engine, so an open window is
// respected. Win Zero's Settings shows its goal's; Win Zero Plus shows each goal's on its own screen
// once there are several (SPEC 9).
import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { currentCheckInTime, firstUpcomingDay, opensAt, pendingWindow, type ClockTime, type GoalState } from '@/engine';
import { formatUntil, formatWhen } from '@/lib/format';
import { appStore, useApp } from '@/store';
import { Field, shared, TextField } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { goalFieldLabel } from '@/ui/copy/goals';
import { GOAL_MAX_LENGTH } from '@/ui/copy/rules';
import { TimeField } from '@/ui/TimeField';
import { useDeviceCalendar } from '@/ui/useDevice';

const KEPT_HINT = 'Your streak and history stay the same.';
const SAVED_HINT = `Saved. ${KEPT_HINT}`;

/** Key it by the goal's id: the wording being typed belongs to one goal. */
export function GoalFields({ goal }: { goal: GoalState }) {
  useApp((s) => s.devClockOffsetMs); // the "next check-in" line follows the debug clock
  const { h24 } = useDeviceCalendar();
  const [draft, setDraft] = useState(goal.goal);
  const [saved, setSaved] = useState(false);

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const pending = pendingWindow(goal, now);
  const upcoming = opensAt(goal, firstUpcomingDay(goal, now));
  const goalChanged = draft.trim() !== goal.goal && draft.trim().length > 0;
  const label = goalFieldLabel(goal);

  const saveGoal = () => {
    if (store.setGoalText(goal.goalId, draft).ok) {
      setDraft(draft.trim());
      setSaved(true);
      // Save goal goes away once saved, so say so: focus has nowhere to land.
      AccessibilityInfo.announceForAccessibility(SAVED_HINT);
    }
  };

  const changeCheckIn = (time: ClockTime) => store.setCheckInTime(goal.goalId, time);
  const changeMorning = (time: ClockTime) => store.setMorningTime(goal.goalId, time);

  return (
    <>
      <View style={shared.section}>
        <Field label={label} hint={saved ? SAVED_HINT : KEPT_HINT}>
          <TextField
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              setSaved(false);
            }}
            maxLength={GOAL_MAX_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => goalChanged && saveGoal()}
            accessibilityLabel={label}
          />
        </Field>
        {goalChanged ? <Button small label="Save goal" onPress={saveGoal} style={styles.start} /> : null}
      </View>

      <View style={shared.section}>
        <TimeField
          label="Check-in time"
          value={currentCheckInTime(goal)}
          onChange={changeCheckIn}
          h24={h24}
          hint={`${pending ? `A check-in is open until ${formatUntil(pending.closesAt, now, tz, h24)}. ` : ''}Next check-in: ${formatWhen(upcoming, now, tz, h24)}.`}
        />
        <TimeField
          label="Reminder"
          value={goal.morningTime}
          onChange={changeMorning}
          h24={h24}
          hint="Only if you haven't answered by then: the next morning, or later the same day if it's after check-in time. Set it to check-in time to get one notification a day."
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
});
