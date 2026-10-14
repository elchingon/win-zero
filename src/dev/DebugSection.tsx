// Development builds only (Settings loads this behind __DEV__, so production bundles leave it
// out). Moves the app's clock to test missed days, slips and resets on a device.
import { StyleSheet, Text, View } from 'react-native';

import { clockTimeAt, dayKeyAt, MS_PER_DAY, MS_PER_HOUR, nextWindow, pendingWindow } from '@/engine';
import { appStore, useApp } from '@/store';
import { colors, fonts, radii, space } from '@/theme/tokens';
import { Eyebrow, Fine } from '@/ui/bits';
import { Button } from '@/ui/Button';

function offsetLabel(ms: number): string {
  if (ms === 0) return 'real time';
  const days = Math.floor(ms / MS_PER_DAY);
  const hours = Math.round((ms - days * MS_PER_DAY) / MS_PER_HOUR);
  return `+${days}d ${hours}h`;
}

export function DebugSection() {
  const goal = useApp((s) => s.goal);
  const offset = useApp((s) => s.devClockOffsetMs);
  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const pending = goal ? pendingWindow(goal, now) : null;
  const next = goal ? nextWindow(goal) : null;
  const at = (d: Date) => `${dayKeyAt(d, tz)} ${clockTimeAt(d, tz)}`;

  const lines = [
    `Now ${at(now)} (${offsetLabel(offset)})`,
    `Zone ${tz}`,
    goal
      ? `Streak ${goal.streak} · slide ${goal.slide} · missed in a row ${goal.consecutiveMissed}${goal.paused ? ' · paused' : ''}`
      : 'No goal',
    pending ? `Open: ${pending.day} until ${at(pending.closesAt)}` : next ? `Next opens ${at(next.opensAt)}` : '',
  ].filter(Boolean);

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
        <Button small variant="ghost" label="Real time" onPress={() => store.resetDevClock()} disabled={offset === 0} />
      </View>
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
});
