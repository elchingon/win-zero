// Development builds only (Settings and Home load this behind __DEV__, so production bundles
// leave it out). Moves the app's clock to test missed days, slips and resets on a device, and
// jumps to a long run to try later weapons, armored zeros and big fills.
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { clockTimeAt, dayKeyAt, MS_PER_DAY, MS_PER_HOUR, nextWindow, pendingWindow } from '@/engine';
import { appStore, useApp } from '@/store';
import { colors, fonts, radii, space } from '@/theme/tokens';
import { Eyebrow, Fine, TextField } from '@/ui/bits';
import { Button, LinkButton } from '@/ui/Button';

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
