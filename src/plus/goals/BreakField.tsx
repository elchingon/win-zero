// Taking a break (SPEC 9): days off for travel or illness, up to BREAK_MAX_DAYS, from the next
// check-in that hasn't opened (engine/breaks.ts). Its days have no check-in and no effect. While one
// is set, the field says when check-ins come back, and its end can move until then: Resume now
// ends it with yesterday, and one that hasn't started can be cancelled.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  addDays,
  BREAK_MAX_DAYS,
  breakResumes,
  breakStartDay,
  breakStatus,
  dayKeyAt,
  diffDays,
  pendingWindow,
  resolve,
  startBreak,
  type GoalState,
} from '@/engine';
import { formatDayWithWeekday, formatWhen, parseCount, relativeDay } from '@/lib/format';
import { appStore, type BreakEditResult } from '@/store';
import { space } from '@/theme/tokens';
import { Chip, Field, Fine, shared, TextField } from '@/ui/bits';
import { Button } from '@/ui/Button';
import { useAnnounce } from '@/ui/announce';
import { useDeviceCalendar } from '@/ui/useDevice';

import { BREAK_COPY } from '../copy';

/** Why a change didn't go through, in words. */
function reasonWords(r: BreakEditResult): string | null {
  if (r.ok) return null;
  if (r.reason === 'too-long') return BREAK_COPY.reasons['too-long'](BREAK_MAX_DAYS);
  if (r.reason === 'no-goal' || r.reason === 'breaks-not-allowed') return BREAK_COPY.reasons['no-break'];
  return BREAK_COPY.reasons[r.reason];
}

export function BreakField({ goal }: { goal: GoalState }) {
  const { h24 } = useDeviceCalendar();
  const store = appStore.getState();
  const now = store.now();
  const tz = store.timeZone();
  const today = dayKeyAt(now, tz);
  const current = resolve(goal, now, tz).state;
  const status = breakStatus(current, now);
  const length = status ? diffDays(status.break.to, status.break.from) + 1 : null;

  const [text, setText] = useState(length ? String(length) : '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  useAnnounce(saved);
  const days = parseCount(text.trim(), BREAK_MAX_DAYS, 1);
  const invalid = text.trim() !== '' && days === null;

  const day = (d: string) => (Math.abs(diffDays(d, today)) <= 1 ? relativeDay(d, today) : formatDayWithWeekday(d));
  const when = (opens: Date) => formatWhen(opens, now, tz, h24);

  const run = (r: BreakEditResult, done: string | null = null) => {
    setError(reasonWords(r));
    setSaved(r.ok ? done : null);
    if (r.ok && done === null) setText('');
  };

  const field = (
    <>
      <TextField
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
          setSaved(null);
        }}
        placeholder="0"
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={String(BREAK_MAX_DAYS).length}
        accessibilityLabel={BREAK_COPY.daysLabel}
      />
      <View style={shared.chips}>
        {BREAK_COPY.presets.map((p) => (
          <Chip key={p.days} label={p.label} selected={days === p.days} onPress={() => setText(String(p.days))} />
        ))}
      </View>
    </>
  );

  if (!status) {
    const from = breakStartDay(current, now);
    const trial = days ? startBreak(current, addDays(from, days - 1), now, tz) : null;
    const set = trial?.ok ? trial.state.breaks?.at(-1) : null;
    return (
      <Field label={BREAK_COPY.label} hint={BREAK_COPY.hint(BREAK_MAX_DAYS)} error={invalid ? BREAK_COPY.invalid(BREAK_MAX_DAYS) : error}>
        {field}
        {set && trial?.ok ? (
          <View style={styles.lines}>
            <Fine>
              {BREAK_COPY.preview(day(set.from), formatDayWithWeekday(set.to))}{' '}
              {BREAK_COPY.back(when(breakResumes(trial.state, set).opensAt))}
            </Fine>
            {pendingWindow(current, now) ? <Fine>{BREAK_COPY.openFirst}</Fine> : null}
            {current.consecutiveMissed > 0 ? <Fine>{BREAK_COPY.missesCarry}</Fine> : null}
          </View>
        ) : null}
        {days ? (
          <Button
            small
            label={BREAK_COPY.start}
            onPress={() => run(appStore.getState().startBreak(goal.goalId, addDays(from, days - 1)), BREAK_COPY.saved)}
            style={styles.button}
          />
        ) : null}
      </Field>
    );
  }

  const { from, to } = status.break;
  const headline =
    status.when === 'ahead'
      ? BREAK_COPY.ahead(day(from), formatDayWithWeekday(to))
      : status.when === 'on'
        ? BREAK_COPY.on(formatDayWithWeekday(to))
        : BREAK_COPY.over(day(to));
  const changed = days !== null && days !== length;
  return (
    <Field label={BREAK_COPY.label} hint={BREAK_COPY.changeHint} error={invalid ? BREAK_COPY.invalid(BREAK_MAX_DAYS) : error}>
      <View style={styles.lines}>
        <Fine>{headline}</Fine>
        <Fine>{BREAK_COPY.back(when(status.resumes.opensAt))}</Fine>
      </View>
      {field}
      {saved ? <Fine>{saved}</Fine> : null}
      <View style={styles.row}>
        {changed ? (
          <Button
            small
            label={BREAK_COPY.save}
            onPress={() => run(appStore.getState().setBreakEnd(goal.goalId, addDays(from, days - 1)), BREAK_COPY.saved)}
          />
        ) : null}
        {status.when !== 'over' ? (
          <Button
            small
            variant="ghost"
            label={status.when === 'on' ? BREAK_COPY.resume : BREAK_COPY.cancel}
            onPress={() => run(appStore.getState().endBreak(goal.goalId))}
          />
        ) : null}
      </View>
    </Field>
  );
}

const styles = StyleSheet.create({
  lines: { gap: space.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  button: { alignSelf: 'flex-start' },
});
