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

import { HIGHLIGHT_ALPHA, HIGHLIGHT_INSET, HIGHLIGHT_START, HIGHLIGHT_SWEEP, HIGHLIGHT_WIDTH, ZERO_GLOW } from './look';
import { ZERO_ASPECT, ZERO_STROKE } from './sim/sizing';

export function highlightPath(rx: number, ry: number, lw: number): SkPath {
  const hx = Math.max(1, rx - lw * HIGHLIGHT_INSET);
  const hy = Math.max(1, ry - lw * HIGHLIGHT_INSET);
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
        {glow ? <BlurMask blur={ry * ZERO_GLOW} style="solid" /> : null}
      </Oval>
      <Path
        path={highlight}
        style="stroke"
        strokeWidth={Math.max(1, lw * HIGHLIGHT_WIDTH)}
        strokeCap="round"
        color={colors.fg}
        opacity={HIGHLIGHT_ALPHA}
      />
    </Group>
  );
}
