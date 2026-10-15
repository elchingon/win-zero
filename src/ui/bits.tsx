// Small pieces from the prototype CSS: eyebrow labels, chips, stat tiles, cards, form fields.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, fonts, radii, space, type } from '@/theme/tokens';

import { feedback } from './feedback';

/** A small uppercase label. `header` makes it a heading, for screen readers' heading navigation. */
export function Eyebrow({ children, color, header }: { children: ReactNode; color?: string; header?: boolean }) {
  return (
    <Text style={[type.eyebrow, color ? { color } : null]} accessibilityRole={header ? 'header' : undefined}>
      {children}
    </Text>
  );
}

export function Fine({ children, color, center }: { children: ReactNode; color?: string; center?: boolean }) {
  return <Text style={[type.fine, color ? { color } : null, center && { textAlign: 'center' }]}>{children}</Text>;
}

export function Lede({ children }: { children: ReactNode }) {
  return <Text style={[type.lede, styles.lede]}>{children}</Text>;
}

/** Amber emphasis inside a heading, like the prototype's h1 em. */
export function Em({ children, color = colors.amber }: { children: ReactNode; color?: string }) {
  return <Text style={{ color }}>{children}</Text>;
}

export function Chip(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={() => {
        feedback.tick();
        props.onPress();
      }}
      style={({ pressed }) => [styles.chip, props.selected && styles.chipOn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[styles.chipLabel, props.selected && { color: colors.amber }]}>{props.label}</Text>
    </Pressable>
  );
}

export function StatTile(props: { label: string; value: string; hero?: boolean; accessibilityLabel?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={props.accessibilityLabel ?? `${props.label}: ${props.value}`}>
      <Text style={type.statLabel} numberOfLines={2}>
        {props.label}
      </Text>
      <Text
        style={[type.statValue, props.hero && styles.statHero]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {props.value}
      </Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Eyebrow>{props.label}</Eyebrow>
      {props.children}
      {props.error ? (
        <Fine color={colors.flare}>{props.error}</Fine>
      ) : props.hint ? (
        <Fine>{props.hint}</Fine>
      ) : null}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      selectionColor={colors.amber}
      cursorColor={colors.amber}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

export function ToggleRow(props: { label: string; detail?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{props.label}</Text>
        {props.detail ? <Text style={styles.rowDetail}>{props.detail}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={props.label}
        accessibilityHint={props.detail}
        value={props.value}
        onValueChange={(v) => {
          feedback.tick();
          props.onChange(v);
        }}
        trackColor={{ false: colors.panel2, true: colors.amber }}
        thumbColor={colors.fg}
        ios_backgroundColor={colors.panel2}
      />
    </View>
  );
}

/** A plain settings row: label and detail on the left, anything on the right. */
export function Row(props: { label: string; detail?: string; right?: ReactNode; onPress?: () => void; hint?: string }) {
  const body = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{props.label}</Text>
        {props.detail ? <Text style={styles.rowDetail}>{props.detail}</Text> : null}
      </View>
      {props.right}
    </>
  );
  if (!props.onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={props.hint}
      onPress={props.onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

export const shared = StyleSheet.create({
  section: { gap: space.md },
  list: { borderTopWidth: 1, borderTopColor: colors.line },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
});

const styles = StyleSheet.create({
  lede: { maxWidth: 420 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipOn: { borderColor: colors.amber },
  chipLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
  stat: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: 12,
    gap: 6,
  },
  statHero: { color: colors.amber, fontSize: 40, lineHeight: 42 },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    padding: 16,
    gap: 10,
  },
  field: { gap: space.sm },
  input: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 14,
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.fg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.fg },
  rowDetail: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted },
});
