// A celebration panel's icon, drawn from its shared path. Apart from the popup, so Home's tests can
// leave Skia out, as they do for the round. Decorative: the panel's title says what it is.
import { Canvas, Group, Path } from '@shopify/react-native-skia';

import type { HighlightKind } from '@/engine';
import { CELEBRATION_MARK_BOX, CELEBRATION_MARKS, colors } from '@/theme/tokens';

const MARK_SIZE = 36;

export function CelebrationMark({ kind }: { kind: HighlightKind }) {
  return (
    <Canvas style={{ width: MARK_SIZE, height: MARK_SIZE }} pointerEvents="none">
      <Group transform={[{ scale: MARK_SIZE / CELEBRATION_MARK_BOX }]}>
        <Path path={CELEBRATION_MARKS[kind]} color={colors.amber} />
      </Group>
    </Canvas>
  );
}
