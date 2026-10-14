// Settings: goal wording, times (through the engine, so an open window is respected),
// sound / haptics / weekly nudge, reminder permission, support, and erase.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ComponentType } from 'react';
import { AppState, Linking, StyleSheet, Text, View } from 'react-native';

import { currentCheckInTime, nextWindow, pendingWindow, type ClockTime } from '@/engine';
import { formatWhen } from '@/lib/format';
import { getReminderPermission, requestReminderPermission, type ReminderPermission } from '@/notifications/permissions';
import { appStore, useApp, type EditResult } from '@/store';
import { colors, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Field, Fine, Row, shared, TextField, ToggleRow } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { Screen } from '@/ui/Screen';
import { SUPPORT_LINE } from '@/ui/support';
import { TimeField } from '@/ui/TimeField';
import { useDeviceCalendar } from '@/ui/useDevice';

// Development builds only: Metro folds __DEV__ to false in production and drops the require.
const DebugSection: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/DebugSection').DebugSection
  : null;

const GOAL_MAX_LENGTH = 60;
const ORDER_ERROR = 'The morning reminder has to come before check-in time.';

const PERMISSION_WORDS: Record<ReminderPermission, string> = {
  granted: 'On',
  denied: 'Off in system settings',
  undetermined: 'Not turned on yet',
};

function errorText(r: EditResult): string | null {
  return r.ok ? null : r.reason === 'order' ? ORDER_ERROR : null;
}

export default function Settings() {
  const goal = useApp((s) => s.goal);
  const prefs = useApp((s) => s.prefs);
  useApp((s) => s.devClockOffsetMs); // the "next check-in" line follows the debug clock
  const { h24 } = useDeviceCalendar();
  const [draft, setDraft] = useState(goal?.goal ?? '');
  const [saved, setSaved] = useState(false);
  const [timeError, setTimeError] = useState<{ checkIn?: string | null; morning?: string | null }>({});
  const [permission, setPermission] = useState<ReminderPermission | null>(null);
  const [eraseArmed, setEraseArmed] = useState(false);

  // Re-read the permission on focus and on return from the system settings app.
  useFocusEffect(
    useCallback(() => {
      const read = () => getReminderPermission().then(setPermission);
      read();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
      return () => sub.remove();
    }, []),
  );

  // Erasing empties the goal on the way out; render nothing while the screen leaves.
  if (!goal) return null;

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const pending = pendingWindow(goal, now);
  const next = nextWindow(goal);
  const goalChanged = draft.trim() !== goal.goal && draft.trim().length > 0;

  const saveGoal = () => {
    if (store.setGoalText(draft).ok) {
      setDraft(draft.trim());
      setSaved(true);
    }
  };

  const changeCheckIn = (time: ClockTime) => setTimeError((e) => ({ ...e, checkIn: errorText(store.setCheckInTime(time)) }));
  const changeMorning = (time: ClockTime) => setTimeError((e) => ({ ...e, morning: errorText(store.setMorningTime(time)) }));

  const erase = () => {
    feedback.press();
    store.erase();
    router.dismissTo('/');
  };

  return (
    <Screen>
      <TopBar right={<LinkButton label="Done" onPress={() => router.back()} />} />
      <Text style={type.h2} accessibilityRole="header">
        Settings
      </Text>

      <View style={shared.section}>
        <Field label="Daily goal" hint={saved ? 'Saved. Your streak and history stay the same.' : 'Your streak and history stay the same.'}>
          <TextField
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              setSaved(false);
            }}
            maxLength={GOAL_MAX_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => goalChanged && saveGoal()}
            accessibilityLabel="Daily goal"
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
          error={timeError.checkIn}
          hint={
            pending
              ? `A check-in is open now. The next one opens ${formatWhen(next.closesAt, now, tz, h24)}.`
              : `Next check-in: ${formatWhen(next.opensAt, now, tz, h24)}.`
          }
        />
        <TimeField
          label="Morning reminder"
          value={goal.morningTime}
          onChange={changeMorning}
          h24={h24}
          error={timeError.morning}
          hint="Sent the next morning, only if you haven't answered."
        />
      </View>

      <View style={shared.list}>
        <ToggleRow label="Sound" detail="Pops and booms in the round." value={prefs.sound} onChange={(v) => store.setPref('sound', v)} />
        <ToggleRow label="Haptics" detail="Taps and buzzes." value={prefs.haptics} onChange={(v) => store.setPref('haptics', v)} />
        <ToggleRow
          label="Weekly nudge"
          detail="If check-ins stop for a while, one gentle reminder a week."
          value={prefs.reengage}
          onChange={(v) => store.setPref('reengage', v)}
        />
        <Row
          label="Reminders"
          detail={permission ? PERMISSION_WORDS[permission] : ' '}
          right={
            permission === 'denied' ? (
              <Button small variant="ghost" label="Open settings" onPress={() => Linking.openSettings()} />
            ) : permission === 'undetermined' ? (
              <Button
                small
                variant="ghost"
                label="Turn on"
                onPress={() => requestReminderPermission().then(setPermission)}
              />
            ) : null
          }
        />
        <Row
          label="Need support?"
          detail={`${SUPPORT_LINE.name}: ${SUPPORT_LINE.display}. ${SUPPORT_LINE.detail}`}
          right={<Text style={styles.call}>Call</Text>}
          hint="Calls the helpline"
          onPress={() => Linking.openURL(SUPPORT_LINE.tel)}
        />
      </View>

      {eraseArmed ? (
        <Card style={styles.erase}>
          <Text style={styles.eraseTitle}>Erase everything?</Text>
          <Fine>This deletes your goal, streak, history and rewards from this phone. It can&apos;t be undone.</Fine>
          <View style={styles.eraseRow}>
            <Button variant="danger" label="Erase everything" onPress={erase} silent style={styles.flex} />
            <Button variant="ghost" label="Keep my data" onPress={() => setEraseArmed(false)} style={styles.flex} />
          </View>
        </Card>
      ) : (
        <LinkButton label="Erase all data" color={colors.flare} onPress={() => setEraseArmed(true)} />
      )}

      {DebugSection ? <DebugSection /> : null}

      <Eyebrow>Win Zero</Eyebrow>
    </Screen>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  call: { ...type.eyebrow, color: colors.amber },
  erase: { borderColor: colors.flare, gap: space.md },
  eraseTitle: { ...type.question },
  eraseRow: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
