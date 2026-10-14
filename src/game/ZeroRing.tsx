// One zero, drawn like the prototype's drawZero(): a glowing oval ring with a soft highlight.
// Centered on (0, 0); position it with `transform`.
import {
  BlurMask,
  Group,
  Oval,
  Path,
  Skia,
  type AnimatedProp,
  type SkPath,
  type Transforms3d,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { colors } from '@/theme/tokens';

import { ZERO_ASPECT, ZERO_STROKE } from './sizing';

/** Glow size as a fraction of the vertical radius (the prototype's shadowBlur, as a blur sigma). */
const GLOW = 0.22;
const HIGHLIGHT_ALPHA = 0.35;
/** The highlight arc, in degrees clockwise from 3 o'clock: 1.1π to 1.45π. */
const HIGHLIGHT_START = 198;
const HIGHLIGHT_SWEEP = 63;

function highlightPath(rx: number, ry: number, lw: number): SkPath {
  const hx = Math.max(1, rx - lw * 0.75);
  const hy = Math.max(1, ry - lw * 0.75);
  const path = Skia.Path.Make();
  path.addArc(Skia.XYWHRect(-hx, -hy, hx * 2, hy * 2), HIGHLIGHT_START, HIGHLIGHT_SWEEP);
  return path;
}

export function ZeroRing(props: {
  ry: number;
  color: string;
  glow?: boolean;
  transform?: AnimatedProp<Transforms3d>;
}) {
  const { ry, color, glow = true, transform } = props;
  const rx = ry * ZERO_ASPECT;
  const lw = ry * ZERO_STROKE;
  const highlight = useMemo(() => highlightPath(rx, ry, lw), [rx, ry, lw]);
  const ox = Math.max(1, rx - lw / 2);
  const oy = Math.max(1, ry - lw / 2);
  return (
    <Group transform={transform}>
      <Oval x={-ox} y={-oy} width={ox * 2} height={oy * 2} style="stroke" strokeWidth={lw} color={color}>
        {glow ? <BlurMask blur={ry * GLOW} style="solid" /> : null}
      </Oval>
      <Path
        path={highlight}
        style="stroke"
        strokeWidth={Math.max(1, lw * 0.18)}
        strokeCap="round"
        color={colors.fg}
        opacity={HIGHLIGHT_ALPHA}
      />
    </Group>
  );
}
