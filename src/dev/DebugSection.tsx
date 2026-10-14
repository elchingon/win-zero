// Development builds only (Settings and Home load this behind __DEV__, so production bundles
// leave it out). Moves the app's clock to test missed days, slips and resets on a device, jumps
// to a long run to try later weapons, armored zeros and big fills, and sends a test check-in.
import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { clockTimeAt, dayKeyAt, MS_PER_DAY, MS_PER_HOUR, nextWindow, pendingWindow } from '@/engine';
import { onSynced } from '@/notifications';
import { getReminderPermission } from '@/notifications/permissions';
import { TEST_DELAY_SECONDS, testCheckInRequest } from '@/notifications/schedule';
import { appStore, useApp } from '@/store';
import { colors, fonts, radii, space } from '@/theme/tokens';
import { Eyebrow, Fine, TextField } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';

import { summarizePending, type PendingSummary } from './pending';
import { SEED_MAX_N } from './seedRun';

/** One per milestone: twin, scatter + first shield, first standard round, rocket, chain, first armored, nuke, a big fill. */
const JUMP_DAYS = [3, 7, 8, 14, 30, 61, 100, 250];

function offsetLabel(ms: number): string {
  if (ms === 0) return 'real time';
  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.round((ms - days * MS_PER_DAY) / MS_PER_HOUR);
  return `+${days}d ${hours}h`;
}

/** A whole number from 1 to `max`, or null. */
function parseCount(text: string, max: number): number | null {
  const n = Number(text);
  return /^\d+$/.test(text) && n >= 1 && n <= max ? n : null;
}

/** Practice rounds can be far bigger than a seeded run: the round is built straight from N. */
const PRACTICE_MAX_N = 100_000;

export function DebugSection() {
  const goal = useApp((s) => s.goal);
  const offset = useApp((s) => s.devClockOffsetMs);
  const pathname = usePathname();
  const [customDay, setCustomDay] = useState('');
  const [practiceN, setPracticeN] = useState('60');
  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const pending = goal ? pendingWindow(goal, now) : null;
  const next = goal ? nextWindow(goal) : null;
  const at = (d: Date) => `${dayKeyAt(d, tz)} ${clockTimeAt(d, tz)}`;
  const custom = parseCount(customDay, SEED_MAX_N);
  const practice = parseCount(practiceN, PRACTICE_MAX_N);
  const [scheduled, setScheduled] = useState<PendingSummary | null>(null);
  const [testNote, setTestNote] = useState<string | null>(null);

  // What the OS has scheduled, re-read after every sync.
  const readScheduled = useCallback(() => {
    Notifications.getAllScheduledNotificationsAsync()
      .then((list) => setScheduled(summarizePending(list)))
      .catch(() => setScheduled(null));
  }, []);
  useEffect(() => {
    readScheduled();
    return onSynced(readScheduled);
  }, [readScheduled]);

  const sendTest = async () => {
    const s = appStore.getState();
    if (!s.goal) return;
    if ((await getReminderPermission()) !== 'granted') {
      setTestNote('Reminders are off. Turn them on in Settings first.');
      return;
    }
    const request = testCheckInRequest(
      { goal: s.goal, now: s.now(), tz: s.timeZone(), showGoal: s.prefs.goalInReminders },
      `test-${Date.now()}`,
    );
    try {
      await Notifications.scheduleNotificationAsync(request);
      setTestNote(`A check-in for ${request.content.data.day} arrives in ${TEST_DELAY_SECONDS} s.`);
    } catch (e) {
      setTestNote(`Couldn't schedule it: ${String(e)}`);
    }
    readScheduled();
  };

  const lines = [
    `Now ${at(now)} (${offsetLabel(offset)})`,
    `Zone ${tz}`,
    goal
      ? `Streak ${goal.streak} · slide ${goal.slide} · missed in a row ${goal.consecutiveMissed}${goal.paused ? ' · paused' : ''}`
      : 'No goal',
    pending ? `Open: ${pending.day} until ${at(pending.closesAt)}` : next ? `Next opens ${at(next.opensAt)}` : '',
  ].filter(Boolean);

  // The answer leaves Home the round to open, so from Settings, go back to Home.
  const jump = (n: number) => {
    if (store.devJumpToDay(n)?.ok && pathname !== '/') router.dismissTo('/');
  };

  return (
    <View style={styles.box}>
      <Eyebrow>Debug clock</Eyebrow>
      <Fine>
        Development builds only. Moving forward settles days as if that time had passed. Going back doesn&apos;t
        undo them; erase data to start over.
      </Fine>
      <View style={styles.readout}>
        {lines.map((l) => (
          <Text key={l} style={styles.line}>
            {l}
          </Text>
        ))}
      </View>
      <View style={styles.row}>
        <Button small variant="ghost" label="+1 hour" onPress={() => store.advanceDevClock(MS_PER_HOUR)} />
        <Button small variant="ghost" label="+1 day" onPress={() => store.advanceDevClock(MS_PER_DAY)} />
        <Button small variant="ghost" label="+7 days" onPress={() => store.advanceDevClock(7 * MS_PER_DAY)} />
        <Button
          small
          variant="ghost"
          label="Next check-in"
          onPress={() => store.devSkipToNextCheckIn()}
          disabled={!goal || !!pending}
          accessibilityHint="Moves the clock to when the next check-in opens"
        />
        <Button small variant="ghost" label="Real time" onPress={() => store.resetDevClock()} disabled={offset === 0} />
      </View>

      <Eyebrow>Notifications</Eyebrow>
      <Fine>
        Reminders follow the debug clock: each is scheduled for its time minus the offset. The test check-in asks about
        the open window (or the next one, which is turned down as not open yet), and its buttons answer for real. Home
        and Play keep it quiet, so lock the phone or stay in Settings to see the banner.
      </Fine>
      <Text style={styles.line}>
        {scheduled
          ? `Pending ${scheduled.count}${scheduled.next ? ` · next: ${scheduled.next}` : ''}`
          : 'Pending: unknown'}
      </Text>
      <View style={styles.row}>
        <Button
          small
          variant="ghost"
          label={`Send test check-in in ${TEST_DELAY_SECONDS} s`}
          onPress={sendTest}
          disabled={!goal}
        />
        <Button small variant="ghost" label="Refresh" onPress={readScheduled} />
      </View>
      {testNote ? <Fine>{testNote}</Fine> : null}

      <Eyebrow>Jump to day</Eyebrow>
      <Fine>
        Rebuilds your history as N−1 days of Yes, then checks in and starts the Day N round. Overwrites your streak,
        history and rewards.
      </Fine>
      <View style={styles.row}>
        {JUMP_DAYS.map((n) => (
          <Button key={n} small variant="ghost" label={`Day ${n}`} onPress={() => jump(n)} disabled={!goal} />
        ))}
      </View>
      <View style={styles.custom}>
        <TextField
          value={customDay}
          onChangeText={setCustomDay}
          placeholder={`1–${SEED_MAX_N}`}
          keyboardType="number-pad"
          returnKeyType="go"
          onSubmitEditing={() => custom && jump(custom)}
          accessibilityLabel="Day to jump to"
          style={styles.input}
        />
        <Button small label="Go" onPress={() => custom && jump(custom)} disabled={!goal || !custom} />
      </View>

      <Eyebrow>Practice round</Eyebrow>
      <Fine>Plays N zeros with every weapon and a frame meter. Nothing about your streak changes.</Fine>
      <View style={styles.custom}>
        <TextField
          value={practiceN}
          onChangeText={setPracticeN}
          placeholder={`1–${PRACTICE_MAX_N}`}
          keyboardType="number-pad"
          accessibilityLabel="Zeros in the practice round"
          style={styles.input}
        />
        <Button
          small
          label="Play"
          onPress={() => practice && router.push({ pathname: '/play', params: { practice: String(practice) } })}
          disabled={!practice}
        />
      </View>
    </View>
  );
}

/** Home's copy of the debug tools, folded away like the prototype's demo controls. */
export function DemoControls() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.demo}>
      <LinkButton label={open ? 'Hide demo controls' : 'Demo controls'} onPress={() => setOpen(!open)} />
      {open ? <DebugSection /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: 14,
    gap: space.md,
  },
  readout: { gap: 2 },
  line: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.fg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  custom: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1 },
  demo: { gap: space.md },
});
