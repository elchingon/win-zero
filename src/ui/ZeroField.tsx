// The slow field of drifting zeros behind every screen, like the prototype's attract mode:
// a radial-gradient backdrop with a dot grid, a few faint zeros, and the screen's darkening wash.
import {
  Canvas,
  Group,
  LinearGradient,
  Points,
  RadialGradient,
  Rect,
  vec,
  type Transforms3d,
} from '@shopify/react-native-skia';
import { usePathname } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

import {
  DOT_ALPHA,
  DOT_ORIGIN,
  DOT_SIZE,
  DOT_SPACING,
  FIELD_ALPHA,
  FIELD_DRIFT_SPEED as DRIFT_SPEED,
  FIELD_MAX_STEP_S as MAX_STEP_S,
  FIELD_SIZE_AS_IF as SIZE_AS_IF,
  FIELD_SIZE_JITTER as SIZE_JITTER,
  FIELD_ZEROS,
  GLOW_RADIUS,
  GLOW_Y,
} from '@/game/look';
import { zeroRadius } from '@/game/sim/sizing';
import { ZeroRing } from '@/game/ZeroRing';
import { colors, withAlpha, zeroPalette } from '@/theme/tokens';

import { useReduceMotion } from './a11y';
/** The screen wash: ink at 40% at the top, deepening to 82% by 55% of the height. */
const WASH = [withAlpha(colors.ink, 0.4), withAlpha(colors.ink, 0.82)];
const WASH_STOPS = [0, 0.55];

interface Drift {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rx: number;
  ry: number;
}

function seed(width: number, height: number): Drift[] {
  const base = zeroRadius(SIZE_AS_IF, width, height);
  return Array.from({ length: FIELD_ZEROS }, () => {
    const ry = base * (1 - SIZE_JITTER / 2 + Math.random() * SIZE_JITTER);
    const rx = ry * 0.72;
    const speed = DRIFT_SPEED * (0.7 + Math.random() * 0.6) * (1 + (40 / Math.max(ry, 10)) * 0.12);
    const angle = Math.random() * Math.PI * 2;
    return {
      x: rx + Math.random() * Math.max(1, width - 2 * rx),
      y: ry + Math.random() * Math.max(1, height - 2 * ry),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rx,
      ry,
    };
  });
}

function DriftingZero(props: { drift: SharedValue<Drift[]>; index: number; ry: number; color: string }) {
  const { drift, index, ry, color } = props;
  const transform = useDerivedValue<Transforms3d>(() => {
    const z = drift.get()[index];
    return [{ translateX: z?.x ?? 0 }, { translateY: z?.y ?? 0 }];
  });
  return <ZeroRing ry={ry} color={color} transform={transform} />;
}

export function ZeroField() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  // The game draws its own backdrop over this one; don't spend frames on drift nobody sees.
  const covered = usePathname() === '/play';
  const initial = useMemo(() => seed(width, height), [width, height]);
  const drift = useSharedValue(initial);
  const bounds = useSharedValue({ width, height });

  useEffect(() => {
    drift.set(initial);
    bounds.set({ width, height });
  }, [initial, width, height, drift, bounds]);

  const frame = useFrameCallback((info) => {
    const dt = Math.min(MAX_STEP_S, (info.timeSincePreviousFrame ?? 16) / 1000);
    const { width: w, height: h } = bounds.get();
    const next = drift.get().map((z) => {
      let { x, y, vx, vy } = z;
      x += vx * dt;
      y += vy * dt;
      if (x < z.rx) {
        x = z.rx;
        vx = Math.abs(vx);
      } else if (x > w - z.rx) {
        x = w - z.rx;
        vx = -Math.abs(vx);
      }
      if (y < z.ry) {
        y = z.ry;
        vy = Math.abs(vy);
      } else if (y > h - z.ry) {
        y = h - z.ry;
        vy = -Math.abs(vy);
      }
      return { ...z, x, y, vx, vy };
    });
    drift.set(next);
  }, false);

  useEffect(() => {
    frame.setActive(!reduceMotion && !covered);
  }, [frame, reduceMotion, covered]);

  const dots = useMemo(() => {
    const out = [];
    for (let y = DOT_ORIGIN.y; y < height; y += DOT_SPACING) {
      for (let x = DOT_ORIGIN.x; x < width; x += DOT_SPACING) out.push(vec(x, y));
    }
    return out;
  }, [width, height]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient
          c={vec(width / 2, height * GLOW_Y)}
          r={Math.max(width, height) * GLOW_RADIUS}
          colors={[colors.ink2, colors.ink]}
        />
      </Rect>
      <Points points={dots} mode="points" color={colors.line} opacity={DOT_ALPHA} strokeWidth={DOT_SIZE} />
      <Group opacity={FIELD_ALPHA}>
        {initial.map((z, i) => (
          <DriftingZero key={i} drift={drift} index={i} ry={z.ry} color={zeroPalette[i % zeroPalette.length] ?? colors.amber} />
        ))}
      </Group>
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={WASH} positions={WASH_STOPS} />
      </Rect>
    </Canvas>
  );
}
