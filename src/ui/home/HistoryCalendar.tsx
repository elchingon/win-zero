// One month of check-ins: yes / not today / shielded / missed, with misses after a long-break
// reset muted as "paused", and (Win Zero Plus, SPEC 9) rest days between chosen check-in days.
// Browsable from the first goal day to today.
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  calendarMark,
  isEveryDay,
  isRestDay,
  settledDays,
  type CalendarMark,
  type DayKey,
  type GoalState,
} from '@/engine';
import { addMonths, monthGrid, monthOf, monthSummary, weekdayInitials, type MonthKey } from '@/lib/calendar';
import { formatDayShort, formatMonth } from '@/lib/format';
import { colors, fonts, fontScale, space } from '@/theme/tokens';
import { Eyebrow, shared } from '@/ui/bits';

type Mark = CalendarMark | 'pending' | 'rest';

const MARK_WORDS: Record<Mark, string> = {
  yes: 'Yes',
  no: 'Not today',
  shielded: 'Shielded',
  missed: 'Missed',
  paused: 'Paused',
  pending: 'Waiting for your answer',
  rest: 'Rest day',
};

const LEGEND: Mark[] = ['yes', 'no', 'shielded', 'missed', 'paused'];

export function MarkGlyph({ mark }: { mark: Mark }) {
  return <View style={glyphs[mark]} />;
}

export function HistoryCalendar(props: {
  goal: GoalState;
  today: DayKey;
  pendingDay: DayKey | null;
  firstWeekday: number;
  /** Mark rest days (SPEC 9): only where goals can check in on chosen days. */
  restDays?: boolean;
}) {
  const { goal, today, pendingDay, firstWeekday, restDays = false } = props;
  const first = monthOf(goal.firstDay);
  const last = monthOf(today);
  const [month, setMonth] = useState(last);
  const shown = month > last ? last : month < first ? first : month;

  const marks = useMemo(() => new Map(goal.history.map((e) => [e.day, calendarMark(e)])), [goal.history]);
  const weeks = useMemo(() => monthGrid(shown, firstWeekday), [shown, firstWeekday]);

  // History decides up to the last settled day: a day there with no entry was a rest day.
  const settled = useMemo(() => (restDays ? settledDays(goal) : null), [restDays, goal]);
  const legend = restDays && !isEveryDay(goal) ? [...LEGEND, 'rest' as const] : LEGEND;

  /** A day before the goal began, or after today, shows no mark of its own. */
  const isOutside = (day: DayKey) => day < goal.firstDay || day > today;
  const markOf = (day: DayKey): Mark | null =>
    marks.get(day) ??
    (day === pendingDay ? 'pending' : settled && !isOutside(day) && isRestDay(goal, day, settled) ? 'rest' : null);

  /** Show another month, and tell a screen reader what's in it. */
  const go = (to: MonthKey) => {
    setMonth(to);
    AccessibilityInfo.announceForAccessibility(monthSummary(to, marks));
  };
  const prev = addMonths(shown, -1);
  const next = addMonths(shown, 1);

  return (
    <View style={shared.section}>
      <View style={shared.sectionHead}>
        <Eyebrow header>History</Eyebrow>
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Previous month, ${formatMonth(prev)}`}
            accessibilityState={{ disabled: shown <= first }}
            disabled={shown <= first}
            onPress={() => go(prev)}
            hitSlop={10}
          >
            <Text style={[styles.arrow, shown <= first && styles.arrowOff]}>‹</Text>
          </Pressable>
          <Text style={styles.month} accessibilityLabel={monthSummary(shown, marks)}>
            {formatMonth(shown)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next month, ${formatMonth(next)}`}
            accessibilityState={{ disabled: shown >= last }}
            disabled={shown >= last}
            onPress={() => go(next)}
            hitSlop={10}
          >
            <Text style={[styles.arrow, shown >= last && styles.arrowOff]}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.grid}>
        {/* The day labels say the weekday, so screen readers skip the initials. */}
        <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {weekdayInitials(firstWeekday).map((d, i) => (
            <Text key={i} style={styles.weekday}>
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const mark = markOf(day);
              const outside = isOutside(day);
              return (
                <View
                  key={day}
                  style={[styles.cell, outside && styles.outside]}
                  accessible={!outside}
                  accessibilityElementsHidden={outside}
                  importantForAccessibility={outside ? 'no-hide-descendants' : 'yes'}
                  accessibilityLabel={`${formatDayShort(day)}${day === today ? ', today' : ''}${mark ? `: ${MARK_WORDS[mark]}` : ''}`}
                >
                  <Text style={[styles.date, day === today && styles.today]} maxFontSizeMultiplier={fontScale.calendarDate}>
                    {Number(day.slice(8))}
                  </Text>
                  <View style={styles.glyphSlot}>{mark ? <MarkGlyph mark={mark} /> : null}</View>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* Each day says its own mark, so screen readers skip the key. */}
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {legend.map((m) => (
          <View key={m} style={styles.legendItem}>
            <MarkGlyph mark={m} />
            <Text style={styles.legendText}>{MARK_WORDS[m]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const ring = { width: 12, height: 16, borderRadius: '50%' as const };

const glyphs = StyleSheet.create({
  yes: { ...ring, borderWidth: 3, borderColor: colors.amber, boxShadow: `0 0 6px ${colors.amber}99` },
  no: { ...ring, borderWidth: 2, borderColor: colors.flare },
  shielded: { ...ring, borderWidth: 3, borderColor: colors.teal, boxShadow: `0 0 6px ${colors.teal}99` },
  missed: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.flare },
  paused: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  pending: { ...ring, borderWidth: 1.5, borderColor: colors.amber, opacity: 0.6 },
  rest: { width: 8, height: 2, borderRadius: 1, backgroundColor: colors.line },
});

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  arrow: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 22, color: colors.fg, paddingHorizontal: 4 },
  arrowOff: { color: colors.line },
  month: { fontFamily: fonts.monoSemiBold, fontSize: 12, letterSpacing: 0.6, color: colors.fg, minWidth: 120, textAlign: 'center' },
  grid: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 10,
    gap: 4,
  },
  week: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.muted,
    paddingBottom: 4,
  },
  cell: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  outside: { opacity: 0.35 },
  date: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  today: { color: colors.fg, fontFamily: fonts.monoSemiBold },
  glyphSlot: { height: 16, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
