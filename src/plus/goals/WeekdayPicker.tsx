// The weekdays a goal checks in on (SPEC 9): seven toggles in the order this phone's week starts,
// at least one always on, with the days in words under them.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Weekday } from '@/engine';
import { weekdayInitials } from '@/lib/calendar';
import { formatDays } from '@/lib/format';
import { colors, fonts, space } from '@/theme/tokens';
import { Field, Fine } from '@/ui/bits';
import { feedback } from '@/ui/feedback';
import { useDeviceCalendar } from '@/ui/useDevice';

import { DAYS_COPY } from '../copy';

/** Read out for each toggle: 0 = Sunday … 6 = Saturday. */
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function WeekdayPicker(props: { days: readonly Weekday[]; onChange: (days: Weekday[]) => void }) {
  const { days, onChange } = props;
  const { firstWeekday } = useDeviceCalendar();
  const initials = weekdayInitials(firstWeekday);
  const order = initials.map((_, i) => ((firstWeekday - 1 + i) % 7) as Weekday);

  const toggle = (day: Weekday) => {
    const on = days.includes(day);
    if (on && days.length === 1) return;
    feedback.tick();
    onChange(on ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b));
  };

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        {order.map((day, i) => {
          const on = days.includes(day);
          const last = on && days.length === 1;
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={DAY_NAMES[day]}
              accessibilityHint={last ? DAYS_COPY.lastDay : undefined}
              onPress={() => toggle(day)}
              hitSlop={4}
              style={({ pressed }) => [styles.day, on && styles.dayOn, pressed && !last && { opacity: 0.7 }]}
            >
              <Text style={[styles.initial, on && styles.initialOn]}>{initials[i]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Fine>{formatDays(days, firstWeekday)}</Fine>
    </View>
  );
}

/** The picker as a form field, for a goal being set up. */
export function ChooseDays(props: { days: readonly Weekday[]; onChange: (days: Weekday[]) => void; hint?: string }) {
  return (
    <Field label={DAYS_COPY.label} hint={props.hint ?? DAYS_COPY.hint}>
      <WeekdayPicker days={props.days} onChange={props.onChange} />
    </Field>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xs },
  day: {
    flex: 1,
    maxWidth: 44,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { borderColor: colors.amber, backgroundColor: colors.panel },
  initial: { fontFamily: fonts.monoSemiBold, fontSize: 13, color: colors.muted },
  initialOn: { color: colors.amber },
});
