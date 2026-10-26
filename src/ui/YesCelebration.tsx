// The celebration for a Yes (src/game/yes.ts), drawn over every screen from the app's root, so it
// carries on while the round opens beneath it: the zero pops out of the button with a burst of mini
// zeros, dark floods out from it, and its hole opens onto the round. The chime and the Yes haptic
// play as it starts, and only those under reduced motion. Idle, it isn't there at all.
import { BlurMask, Canvas, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import { HIGHLIGHT_ALPHA, HIGHLIGHT_INSET, HIGHLIGHT_START, HIGHLIGHT_SWEEP, HIGHLIGHT_WIDTH, ZERO_GLOW } from '@/game/look';
import { useSfx, type Sound } from '@/game/sfx';
import { ZERO_ASPECT, ZERO_STROKE } from '@/game/sim/sizing';
import { YES_SPARKS, YES_TOTAL_MS, yesFrame, yesOrigin, yesSpark, type Point, type YesShow } from '@/game/yes';
import { themeOf, useApp } from '@/store';
import { THEME_LOOKS } from '@/theme/themes';
import { colors } from '@/theme/tokens';

import { useReduceEffects } from './a11y';
import { yesCelebration } from './celebrate';
import { feedback } from './feedback';

const SOUNDS: readonly Sound[] = ['yes'];
/** The zero's glow, capped so a ring the size of the screen doesn't blur the whole frame. */
const RING_GLOW_MAX = 10;
/** The bright line on the dark's outer edge. */
const RIM_WIDTH = 3;
const RIM_GLOW = 6;
/** The mini zeros wear the theme's ring colors, one path per palette slot. */
const SLOTS = [0, 1, 2, 3] as const;

/** Adds a zero-shaped oval of vertical radius `ry` centered at (x, y). */
function addZeroOval(path: SkPath, x: number, y: number, ry: number) {
  'worklet';
  const rx = ry * ZERO_ASPECT;
  path.addOval(Skia.XYWHRect(x - rx, y - ry, rx * 2, ry * 2));
}

export function YesCelebration() {
  const reduceMotion = useReduceEffects();
  const play = useSfx(SOUNDS);
  const still = useRef(reduceMotion);
  useEffect(() => {
    still.current = reduceMotion;
  }, [reduceMotion]);
  useEffect(
    () =>
      yesCelebration.mount({
        motion: () => !still.current,
        cue: () => {
          play('yes');
          feedback.yes();
        },
      }),
    [play],
  );
  const show = useSyncExternalStore(yesCelebration.subscribe, yesCelebration.current);
  return show ? <Show key={show.id} show={show} /> : null;
}

function Show({ show }: { show: YesShow }) {
  const { width, height } = useWindowDimensions();
  const palette = THEME_LOOKS[useApp(themeOf)].palette;
  // Fixed for the show's length.
  const [size] = useState(() => ({ width, height }));
  const [origin] = useState(() => yesOrigin(show.origin, size));
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(withTiming(YES_TOTAL_MS, { duration: YES_TOTAL_MS, easing: Easing.linear }));
    const id = setTimeout(() => yesCelebration.end(show.id), YES_TOTAL_MS);
    return () => clearTimeout(id);
  }, [t, show.id]);

  const frame = useDerivedValue(() => yesFrame(t.get(), origin, size));
  // The dark: between the hole and its outer edge.
  const cover = useDerivedValue(() => {
    const f = frame.get();
    const path = Skia.Path.Make();
    if (f.coverAlpha > 0) {
      addZeroOval(path, f.x, f.y, f.cover);
      addZeroOval(path, f.x, f.y, f.hole);
    }
    return path;
  });
  const rim = useDerivedValue(() => {
    const f = frame.get();
    const path = Skia.Path.Make();
    if (f.rimAlpha > 0) addZeroOval(path, f.x, f.y, f.cover);
    return path;
  });
  const rimAlpha = useDerivedValue(() => frame.get().rimAlpha);
  // The zero itself, round the hole, drawn like the round's zeros: a glowing ring with a highlight.
  const ring = useDerivedValue(() => {
    const f = frame.get();
    const path = Skia.Path.Make();
    if (f.ring > 0) addZeroOval(path, f.x, f.y, f.hole + f.ring / 2);
    return path;
  });
  const ringWidth = useDerivedValue(() => frame.get().ring);
  const ringGlow = useDerivedValue(() => {
    const f = frame.get();
    return Math.min(RING_GLOW_MAX, (f.hole + f.ring) * ZERO_GLOW);
  });
  const highlight = useDerivedValue(() => {
    const f = frame.get();
    const path = Skia.Path.Make();
    const ry = f.hole + f.ring;
    const hx = Math.max(1, ry * ZERO_ASPECT - f.ring * HIGHLIGHT_INSET);
    const hy = Math.max(1, ry - f.ring * HIGHLIGHT_INSET);
    if (f.ring > 0) path.addArc(Skia.XYWHRect(f.x - hx, f.y - hy, hx * 2, hy * 2), HIGHLIGHT_START, HIGHLIGHT_SWEEP);
    return path;
  });
  const highlightWidth = useDerivedValue(() => Math.max(1, frame.get().ring * HIGHLIGHT_WIDTH));
  const amber = palette[0];

  return (
    // Takes the screen's touches while it plays, and stays out of screen readers' way.
    <View style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Canvas style={StyleSheet.absoluteFill}>
        <Path path={cover} fillType="evenOdd" color={colors.ink} />
        <Path path={rim} style="stroke" strokeWidth={RIM_WIDTH} color={amber} opacity={rimAlpha}>
          <BlurMask blur={RIM_GLOW} style="solid" />
        </Path>
        {SLOTS.map((slot) => (
          <Sparks key={slot} slot={slot} t={t} origin={origin} color={palette[slot]} />
        ))}
        <Path path={ring} style="stroke" strokeWidth={ringWidth} color={amber}>
          <BlurMask blur={ringGlow} style="solid" />
        </Path>
        <Path
          path={highlight}
          style="stroke"
          strokeWidth={highlightWidth}
          strokeCap="round"
          color={colors.fg}
          opacity={HIGHLIGHT_ALPHA}
        />
      </Canvas>
    </View>
  );
}

/** The mini zeros in one palette slot: every SLOTS.length-th, starting at `slot`. */
function Sparks(props: { slot: number; t: SharedValue<number>; origin: Point; color: string }) {
  const { slot, t, origin, color } = props;
  const path = useDerivedValue(() => {
    const p = Skia.Path.Make();
    for (let i = slot; i < YES_SPARKS; i += SLOTS.length) {
      const s = yesSpark(i, t.get(), origin);
      if (s.alpha > 0) addZeroOval(p, s.x, s.y, s.ry * (1 - ZERO_STROKE / 2));
    }
    return p;
  });
  // Every spark is the same size and opacity at a given moment.
  const width = useDerivedValue(() => yesSpark(slot, t.get(), origin).ry * ZERO_STROKE);
  const opacity = useDerivedValue(() => yesSpark(slot, t.get(), origin).alpha);
  return <Path path={path} style="stroke" strokeWidth={width} color={color} opacity={opacity} />;
}
