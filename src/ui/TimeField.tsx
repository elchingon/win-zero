// A time setting: a field showing the time, and a bottom sheet of snapping wheels to change it.
// Pure JS (no native picker), so it needs no new dev build and matches the app's look.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { clockMinutes, type ClockTime } from '@/engine';
import { formatClockTime } from '@/lib/format';
import { colors, fonts, radii, space } from '@/theme/tokens';

import { Field } from './bits';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { feedback } from './feedback';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const MINUTE_STEP = 5;

const pad = (n: number) => String(n).padStart(2, '0');

function Wheel(props: { items: string[]; selected: number; onSelect: (index: number) => void; label: string }) {
  const { items, selected, onSelect, label } = props;
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(selected);
  const [initial] = useState(selected);
  const clamp = (i: number) => Math.min(items.length - 1, Math.max(0, i));

  useEffect(() => {
    // contentOffset isn't honoured on every platform at mount, so scroll once laid out.
    const id = requestAnimationFrame(() => ref.current?.scrollTo({ y: initial * ITEM_HEIGHT, animated: false }));
    return () => cancelAnimationFrame(id);
  }, [initial]);

  const choose = (i: number) => {
    const next = clamp(i);
    if (next === index) return;
    setIndex(next);
    onSelect(next);
    feedback.tick();
  };
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => choose(Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT));
  /** A release with no fling has no momentum phase, so settle there; otherwise wait for it to stop. */
  const settleIfStill = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Math.abs(e.nativeEvent.velocity?.y ?? 0) < 0.05) settle(e);
  };

  return (
    <View
      style={styles.wheel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = clamp(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1));
        ref.current?.scrollTo({ y: next * ITEM_HEIGHT, animated: true });
        choose(next);
      }}
    >
      <View pointerEvents="none" style={styles.band} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: initial * ITEM_HEIGHT }}
        contentContainerStyle={styles.wheelContent}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settleIfStill}
        scrollEventThrottle={16}
      >
        {items.map((item, i) => (
          <Pressable
            key={item}
            onPress={() => {
              ref.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
              choose(i);
            }}
            style={styles.item}
            importantForAccessibility="no"
          >
            <Text style={[styles.itemText, i === index && styles.itemOn]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function TimeSheet(props: { value: ClockTime; h24: boolean; onDone: (time: ClockTime) => void; onCancel: () => void }) {
  const { value, h24, onDone, onCancel } = props;
  const start = clockMinutes(value);
  const [hour, setHour] = useState(Math.floor(start / 60));
  const [minute, setMinute] = useState(start % 60);

  const minutes = useMemo(() => {
    const grid = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
    // Keep a time that was set off the 5-minute grid selectable as it is.
    return grid.includes(start % 60) ? grid : [...grid, start % 60].sort((a, b) => a - b);
  }, [start]);

  const hours12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const pm = hour >= 12;

  return (
    <>
      <View style={styles.wheels}>
        {h24 ? (
          <Wheel label="Hour" items={Array.from({ length: 24 }, (_, h) => pad(h))} selected={hour} onSelect={setHour} />
        ) : (
          <Wheel
            label="Hour"
            items={hours12.map(String)}
            selected={hour % 12}
            onSelect={(i) => setHour((i % 12) + (pm ? 12 : 0))}
          />
        )}
        <Text style={styles.colon}>:</Text>
        <Wheel
          label="Minute"
          items={minutes.map(pad)}
          selected={Math.max(0, minutes.indexOf(minute))}
          onSelect={(i) => setMinute(minutes[i] ?? 0)}
        />
        {h24 ? null : (
          <Wheel
            label="AM or PM"
            items={['AM', 'PM']}
            selected={pm ? 1 : 0}
            onSelect={(i) => setHour((h) => (h % 12) + (i === 1 ? 12 : 0))}
          />
        )}
      </View>
      <View style={styles.actions}>
        <Button label="Cancel" variant="ghost" onPress={onCancel} style={styles.action} />
        <Button label="Done" onPress={() => onDone(`${pad(hour)}:${pad(minute)}`)} style={styles.action} />
      </View>
    </>
  );
}

export function TimeField(props: {
  label: string;
  value: ClockTime;
  onChange: (time: ClockTime) => void;
  h24: boolean;
  hint?: string;
  error?: string | null;
}) {
  const { label, value, onChange, h24, hint, error } = props;
  const [open, setOpen] = useState(false);
  const shown = formatClockTime(value, h24);
  return (
    <Field label={label} hint={hint} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityHint="Opens a time picker"
        onPress={() => {
          feedback.press();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.field, error ? styles.fieldError : null, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.fieldText}>{shown}</Text>
        <Text style={styles.fieldEdit}>Change</Text>
      </Pressable>
      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <TimeSheet
          value={value}
          h24={h24}
          onCancel={() => setOpen(false)}
          onDone={(time) => {
            setOpen(false);
            onChange(time);
          }}
        />
      </BottomSheet>
    </Field>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 14,
  },
  fieldError: { borderColor: colors.flare },
  fieldText: { fontFamily: fonts.bodySemiBold, fontSize: 18, color: colors.fg },
  fieldEdit: { fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 1.3, color: colors.muted, textTransform: 'uppercase' },
  wheels: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm },
  wheel: { width: 76, height: ITEM_HEIGHT * VISIBLE_ITEMS },
  wheelContent: { paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2) },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
    height: ITEM_HEIGHT,
    borderRadius: radii.md,
    backgroundColor: colors.panel2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontFamily: fonts.display, fontSize: 20, color: colors.muted },
  itemOn: { color: colors.amber },
  colon: { fontFamily: fonts.display, fontSize: 20, color: colors.muted },
  actions: { flexDirection: 'row', gap: space.md, paddingBottom: space.lg },
  action: { flex: 1 },
});
