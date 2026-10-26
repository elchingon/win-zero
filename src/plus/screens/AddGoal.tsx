// Add a goal (SPEC 9): another goal beside the first, up to this app's limit, with its own wording,
// times and check-in days. The first goal comes from Setup.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DEFAULT_CHECK_IN_TIME, DEFAULT_MORNING_TIME, EVERY_DAY, type Weekday } from '@/engine';
import { appStore, canAddGoal, useApp } from '@/store';
import { type } from '@/theme/tokens';
import { Card, Chip, Field, Lede, shared, TextField } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { GOAL_MAX_LENGTH, SUGGESTIONS } from '@/ui/copy/rules';
import { feedback } from '@/ui/feedback';
import { Screen } from '@/ui/Screen';
import { TimeField } from '@/ui/TimeField';
import { useDeviceCalendar } from '@/ui/useDevice';

import { ADD_GOAL_COPY } from '../copy';
import { ChooseDays } from '../goals/WeekdayPicker';
import { leave } from '../nav';

export function AddGoal() {
  const roomy = useApp(canAddGoal);
  const maxGoals = useApp((s) => s.limits.maxGoals);
  const { h24 } = useDeviceCalendar();
  const [goal, setGoal] = useState('');
  const [checkInTime, setCheckInTime] = useState(DEFAULT_CHECK_IN_TIME);
  const [morningTime, setMorningTime] = useState(DEFAULT_MORNING_TIME);
  const [days, setDays] = useState<Weekday[]>([...EVERY_DAY]);
  const [added, setAdded] = useState(false);
  const goalOk = goal.trim().length > 0;

  // Leaving after the goal went in: the slot it took isn't "full" news.
  if (added) return null;

  const add = () => {
    const r = appStore.getState().addGoal({ goal, checkInTime, morningTime, days });
    if (!r.ok) return;
    feedback.success();
    setAdded(true);
    leave();
  };

  return (
    <Screen>
      <TopBar right={<LinkButton label="Cancel" onPress={leave} />} />
      <Text style={type.h2} accessibilityRole="header">
        {ADD_GOAL_COPY.title}
      </Text>
      {roomy ? (
        <>
          <Lede>{ADD_GOAL_COPY.lede}</Lede>
          <View style={styles.form}>
            <Field label={ADD_GOAL_COPY.field}>
              <TextField
                value={goal}
                onChangeText={setGoal}
                placeholder={ADD_GOAL_COPY.placeholder}
                maxLength={GOAL_MAX_LENGTH}
                returnKeyType="done"
                autoCapitalize="sentences"
                accessibilityLabel={ADD_GOAL_COPY.field}
              />
              <View style={shared.chips}>
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} label={s} selected={goal.trim() === s} onPress={() => setGoal(s)} />
                ))}
              </View>
            </Field>
            <TimeField
              label="Check-in time"
              value={checkInTime}
              onChange={setCheckInTime}
              h24={h24}
              hint="An evening time works best, once your day is done."
            />
            <TimeField
              label="Reminder"
              value={morningTime}
              onChange={setMorningTime}
              h24={h24}
              hint="Only if you haven't answered by then: the next morning, or later the same day if it's after check-in time."
            />
            <ChooseDays days={days} onChange={setDays} />
            <Button
              label={ADD_GOAL_COPY.add}
              onPress={add}
              disabled={!goalOk}
              accessibilityHint={goalOk ? undefined : 'Enter a goal first'}
            />
          </View>
        </>
      ) : (
        <Card>
          <Lede>{ADD_GOAL_COPY.full(maxGoals)}</Lede>
          <Button variant="ghost" label={ADD_GOAL_COPY.back} onPress={leave} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
});
