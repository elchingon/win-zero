// Settings: goal wording, times (through the engine, so an open window is respected),
// sound / haptics / weekly nudge, reminder permission, how it works, support, about (privacy
// policy, help, email, version), and erase.
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { currentCheckInTime, firstUpcomingDay, opensAt, pendingWindow, type ClockTime } from '@/engine';
import { formatUntil, formatWhen } from '@/lib/format';
import type { ReminderPermission } from '@/notifications/permissions';
import { appStore, useApp } from '@/store';
import { colors, space, type } from '@/theme/tokens';
import { Card, Eyebrow, Field, Fine, Row, shared, TextField, ToggleRow } from '@/ui/bits';
import { TopBar } from '@/ui/Brand';
import { Button, LinkButton } from '@/ui/Button';
import { feedback } from '@/ui/feedback';
import { Screen } from '@/ui/Screen';
import { APP_LINKS, callSupportLine, emailSupport, openPage, SUPPORT_LINE } from '@/ui/support';
import { TimeField } from '@/ui/TimeField';
import { useDeviceCalendar } from '@/ui/useDevice';
import { useReminderPermission } from '@/ui/useReminderPermission';

// Development builds only: Metro folds __DEV__ to false in production and drops the require.
const DebugSection: ComponentType | null = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/dev/DebugSection').DebugSection
  : null;

const GOAL_MAX_LENGTH = 60;
/** The app version from app.json, as built. */
const APP_VERSION = Constants.expoConfig?.version;
const APP_NAME = APP_VERSION ? `Win Zero ${APP_VERSION}` : 'Win Zero';
/** From the environment; a build without them leaves their rows out (see APP_LINKS). */
const PRIVACY_URL = APP_LINKS.privacy;
const SUPPORT_URL = APP_LINKS.support;

const PERMISSION_WORDS: Record<ReminderPermission, string> = {
  granted: 'On',
  denied: 'Off in system settings',
  undetermined: 'Not turned on yet',
};

export default function Settings() {
  const goal = useApp((s) => s.goal);
  const prefs = useApp((s) => s.prefs);
  useApp((s) => s.devClockOffsetMs); // the "next check-in" line follows the debug clock
  const { h24 } = useDeviceCalendar();
  const [draft, setDraft] = useState(goal?.goal ?? '');
  const [saved, setSaved] = useState(false);
  const { permission, turnOn } = useReminderPermission();
  const [eraseArmed, setEraseArmed] = useState(false);

  // Erasing empties the goal on the way out; render nothing while the screen leaves.
  if (!goal) return null;

  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const pending = pendingWindow(goal, now);
  const upcoming = opensAt(goal, firstUpcomingDay(goal, now));
  const goalChanged = draft.trim() !== goal.goal && draft.trim().length > 0;

  const saveGoal = () => {
    if (store.setGoalText(draft).ok) {
      setDraft(draft.trim());
      setSaved(true);
    }
  };

  const changeCheckIn = (time: ClockTime) => store.setCheckInTime(time);
  const changeMorning = (time: ClockTime) => store.setMorningTime(time);

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

      <View style={shared.list}>
        <ToggleRow label="Sound" detail="Pops and booms in the round." value={prefs.sound} onChange={(v) => store.setPref('sound', v)} />
        <ToggleRow label="Haptics" detail="Taps and buzzes." value={prefs.haptics} onChange={(v) => store.setPref('haptics', v)} />
        <ToggleRow
          label="Weekly nudge"
          detail="If check-ins stop for a while, one gentle reminder a week."
          value={prefs.reengage}
          onChange={(v) => store.setPref('reengage', v)}
        />
        <ToggleRow
          label="Goal in reminders"
          detail="Off keeps your goal private on the lock screen. Reminders just say “your goal”."
          value={prefs.goalInReminders}
          onChange={(v) => store.setPref('goalInReminders', v)}
        />
        <Row
          label="Reminders"
          detail={permission ? PERMISSION_WORDS[permission] : ' '}
          right={
            permission === 'denied' ? (
              <Button small variant="ghost" label="Open settings" onPress={turnOn} />
            ) : permission === 'undetermined' ? (
              <Button small variant="ghost" label="Turn on" onPress={turnOn} />
            ) : null
          }
        />
        <Row
          label="How it works"
          detail="The slide, shields, missed days and rewards."
          right={<Text style={styles.call}>Read</Text>}
          hint="Opens the rules in plain words"
          onPress={() => router.push('/how-it-works')}
        />
        <Row
          label="Need support?"
          detail={`${SUPPORT_LINE.name}: ${SUPPORT_LINE.display}. ${SUPPORT_LINE.detail}`}
          right={<Text style={styles.call}>Call</Text>}
          hint="Calls the helpline"
          onPress={callSupportLine}
        />
      </View>

      <View style={shared.section}>
        <Eyebrow header>About</Eyebrow>
        <View style={shared.list}>
          {PRIVACY_URL ? (
            <Row
              label="Privacy policy"
              detail="Your goal and history stay on this phone."
              right={<Text style={styles.call}>Open</Text>}
              hint="Opens the privacy policy in your browser"
              onPress={() => openPage(PRIVACY_URL)}
            />
          ) : null}
          {SUPPORT_URL ? (
            <Row
              label="Help and support"
              detail="How Win Zero works, and fixes for common questions."
              right={<Text style={styles.call}>Open</Text>}
              hint="Opens the support page in your browser"
              onPress={() => openPage(SUPPORT_URL)}
            />
          ) : null}
          <Row
            label="Email us"
            detail={APP_LINKS.email}
            right={<Text style={styles.call}>Email</Text>}
            hint="Starts an email to Win Zero support"
            onPress={() => emailSupport(APP_NAME)}
          />
        </View>
        <Fine>{APP_NAME} · © 2026 E7 Systems</Fine>
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
