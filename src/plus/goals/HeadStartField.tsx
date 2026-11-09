// A head start (SPEC 9): days already done before a goal is set up, which go in as Yes days
// (engine/headStart.ts). Typed, or picked from a few chips, from 0 to the app's limit, with a line
// saying what the goal starts with. The parent keeps the text, and reads it with headStartFrom.
import { View } from 'react-native';

import {
  createGoalWithHeadStart,
  headStartPreview,
  newlyUnlockedThemes,
  type ModeId,
  type ThemeReach,
  type Weekday,
} from '@/engine';
import { joinAnd, parseCount, plural } from '@/lib/format';
import { appStore, arsenalBestOf, gameModeOf, useApp } from '@/store';
import { Chip, Field, Fine, shared, TextField } from '@/ui/bits';
import { powerUp } from '@/ui/copy/modes';

import { HEAD_START_COPY } from '../copy';

/** The chips, up to the app's limit. */
const PRESETS: readonly number[] = [0, 3, 7, 14, 30];

/** The head start typed: 0 for none (left empty), or null for anything that isn't one. */
export function headStartFrom(text: string, max: number): number | null {
  const t = text.trim();
  return t === '' ? 0 : parseCount(t, max, 0);
}

/** What a head start of `n` starts a goal with, and what it opens, in words. */
function previewOf(n: number, days: readonly Weekday[], reach: ThemeReach, mode: ModeId, themesEnabled: boolean): string {
  const store = appStore.getState();
  const goal = createGoalWithHeadStart({ goalId: 'preview', goal: 'preview', days, headStart: n, now: store.now(), tz: store.timeZone() });
  const p = headStartPreview(goal, reach.best);
  const gear = [plural(p.zeros, 'zero')];
  if (p.bombs > 0) gear.push(plural(p.bombs, 'bomb'));
  if (p.shields > 0) gear.push(p.shields === 1 ? 'a shield' : plural(p.shields, 'shield'));
  const next = { ...reach, best: Math.max(reach.best, goal.bestStreak) };
  const opens = [
    ...p.weapons.map((w) => `the ${powerUp(mode, w).name}`),
    ...newlyUnlockedThemes(reach, next, { themesEnabled }).map((t) => `the ${t.name} theme`),
  ];
  const line = HEAD_START_COPY.preview(joinAnd(gear), p.firstRound);
  return opens.length > 0 ? `${line} ${HEAD_START_COPY.opens(joinAnd(opens))}` : line;
}

export function HeadStartField(props: { value: string; onChange: (text: string) => void; days: readonly Weekday[] }) {
  const max = useApp((s) => s.limits.headStartMax);
  const best = useApp(arsenalBestOf);
  const cameBack = useApp((s) => s.cameBack);
  const mode = useApp(gameModeOf);
  const themesEnabled = useApp((s) => s.limits.themesEnabled);
  const n = headStartFrom(props.value, max);
  return (
    <Field label={HEAD_START_COPY.label} hint={HEAD_START_COPY.hint(max)} error={n === null ? HEAD_START_COPY.invalid(max) : null}>
      <TextField
        value={props.value}
        onChangeText={props.onChange}
        placeholder="0"
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={String(max).length}
        accessibilityLabel={HEAD_START_COPY.label}
      />
      <View style={shared.chips}>
        {PRESETS.filter((p) => p <= max).map((p) => (
          <Chip
            key={p}
            label={p === 0 ? HEAD_START_COPY.none : String(p)}
            selected={n === p}
            onPress={() => props.onChange(p === 0 ? '' : String(p))}
          />
        ))}
      </View>
      {n ? <Fine>{previewOf(n, props.days, { best, cameBack }, mode, themesEnabled)}</Fine> : null}
    </Field>
  );
}
