// Small pieces from the prototype CSS: eyebrow labels, chips, stat tiles, cards, form fields.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, fonts, radii, space, type } from '@/theme/tokens';

import { useAnnounce } from './announce';
import { feedback } from './feedback';
import { MIN_TARGET, targetInset } from './target';

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

/** A pill to pick, in a touch target of MIN_TARGET. Lay several out in `shared.chips`. */
export function Chip(props: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={() => {
        feedback.tick();
        props.onPress();
      }}
      style={({ pressed }) => [shared.chipTarget, pressed && { opacity: 0.7 }]}
    >
      <View style={[shared.chip, props.selected && shared.chipOn]}>
        <Text style={[shared.chipLabel, props.selected && { color: colors.amber }]}>{props.label}</Text>
      </View>
    </Pressable>
  );
}

/** The hint button: a small "i" in a ring, in a touch target of MIN_TARGET. */
const HINT_SIZE = 22;
/** How far a hint sits in from a tile's top-right corner. */
const HINT_INSET = 8;

/** A small "i" in a ring that opens a hint, such as on a stat tile's corner. */
export function HintButton(props: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      onPress={() => {
        feedback.press();
        props.onPress();
      }}
      style={({ pressed }) => [styles.hintTarget, pressed && { opacity: 0.6 }, props.style]}
    >
      <View style={styles.hint}>
        <Text style={styles.hintGlyph} maxFontSizeMultiplier={1} importantForAccessibility="no">
          i
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * A number with its label, and an optional caption under it (say, the dates it covers). `help`
 * adds a hint button in the top-right corner, outside the tile's one spoken group so screen
 * readers reach it on its own. `onPress` (Win Zero Plus's secret) takes taps on the tile itself,
 * with no look or role of a button.
 */
export function StatTile(props: {
  label: string;
  value: string;
  hero?: boolean;
  caption?: string;
  accessibilityLabel?: string;
  help?: { label: string; onPress: () => void };
  onPress?: () => void;
}) {
  const { help, onPress } = props;
  const spoken = `${props.label}: ${props.value}${props.caption ? `, ${props.caption}` : ''}`;
  const Tile = onPress ? Pressable : View;
  const tile = (
    <Tile
      style={[styles.stat, help && styles.statFill]}
      accessible
      accessibilityLabel={props.accessibilityLabel ?? spoken}
      onPress={onPress}
    >
      <Text style={[type.statLabel, help && styles.statLabelClear]} numberOfLines={2}>
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
      {props.caption ? (
        <Text style={type.fine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {props.caption}
        </Text>
      ) : null}
    </Tile>
  );
  if (!help) return tile;
  return (
    <View style={styles.statWrap}>
      {tile}
      <HintButton label={help.label} onPress={help.onPress} style={styles.statHint} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  useAnnounce(props.error);
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
  /** A wrapping row of chips. Their targets space the rows, so only the columns have a gap. */
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm },
  chipTarget: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, justifyContent: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: colors.edge,
    borderRadius: radii.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipOn: { borderColor: colors.amber },
  chipLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
});

const styles = StyleSheet.create({
  lede: { maxWidth: 420 },
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
  statWrap: { flex: 1, minWidth: 0 },
  statFill: { flex: 0, flexGrow: 1 },
  statLabelClear: { paddingRight: HINT_SIZE + space.xs },
  statHint: { position: 'absolute', top: HINT_INSET, right: HINT_INSET },
  hintTarget: {
    width: MIN_TARGET,
    height: MIN_TARGET,
    margin: targetInset(HINT_SIZE),
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    width: HINT_SIZE,
    height: HINT_SIZE,
    borderRadius: HINT_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintGlyph: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 15, color: colors.muted },
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
    borderColor: colors.edge,
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
