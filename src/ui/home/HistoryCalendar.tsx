// One month of check-ins: yes / not today / shielded / missed, with misses after a long-break
// reset muted as "paused". Browsable from the first goal day to today.
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calendarMark, type CalendarMark, type DayKey, type GoalState } from '@/engine';
import { addMonths, monthGrid, monthOf, weekdayInitials } from '@/lib/calendar';
import { formatDayShort, formatMonth } from '@/lib/format';
import { colors, fonts, fontScale, space } from '@/theme/tokens';
import { Eyebrow, shared } from '@/ui/bits';

type Mark = CalendarMark | 'pending';

const MARK_WORDS: Record<Mark, string> = {
  yes: 'Yes',
  no: 'Not today',
  shielded: 'Shielded',
  missed: 'Missed',
  paused: 'Paused',
  pending: 'Waiting for your answer',
};

const LEGEND: Mark[] = ['yes', 'no', 'shielded', 'missed', 'paused'];

export function MarkGlyph({ mark }: { mark: Mark }) {
  return <View style={glyphs[mark]} />;
}

export function HistoryCalendar(props: { goal: GoalState; today: DayKey; pendingDay: DayKey | null; firstWeekday: number }) {
  const { goal, today, pendingDay, firstWeekday } = props;
  const first = monthOf(goal.firstDay);
  const last = monthOf(today);
  const [month, setMonth] = useState(last);
  const shown = month > last ? last : month < first ? first : month;

  const marks = useMemo(() => new Map(goal.history.map((e) => [e.day, calendarMark(e)])), [goal.history]);
  const weeks = useMemo(() => monthGrid(shown, firstWeekday), [shown, firstWeekday]);

  const markOf = (day: DayKey): Mark | null => marks.get(day) ?? (day === pendingDay ? 'pending' : null);

  return (
    <View style={shared.section}>
      <View style={shared.sectionHead}>
        <Eyebrow>History</Eyebrow>
        <View style={styles.nav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            disabled={shown <= first}
            onPress={() => setMonth(addMonths(shown, -1))}
            hitSlop={10}
          >
            <Text style={[styles.arrow, shown <= first && styles.arrowOff]}>‹</Text>
          </Pressable>
          <Text style={styles.month}>{formatMonth(shown)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            disabled={shown >= last}
            onPress={() => setMonth(addMonths(shown, 1))}
            hitSlop={10}
          >
            <Text style={[styles.arrow, shown >= last && styles.arrowOff]}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.week}>
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
              const outside = day < goal.firstDay || day > today;
              return (
                <View
                  key={day}
                  style={[styles.cell, outside && styles.outside]}
                  accessible
                  accessibilityLabel={`${formatDayShort(day)}${mark ? `: ${MARK_WORDS[mark]}` : ''}`}
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

      <View style={styles.legend}>
        {LEGEND.map((m) => (
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
