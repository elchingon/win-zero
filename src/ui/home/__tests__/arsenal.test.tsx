// The arsenal's locked rows: dimmed by color, never by fading, so their text keeps 4.5:1.
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { WEAPONS } from '@/engine';
import { colors } from '@/theme/tokens';
import { contrast } from '@/theme/__tests__/contrast';

import { Arsenal } from '../Arsenal';

/** Every surface the arsenal is drawn on: Home's backdrop, and the panels around it. */
const SURFACES = [colors.ink, colors.ink2, colors.panel];

type Node = { type: string; props: { style?: unknown; children?: unknown }; children: (Node | string)[] | null };

function texts(node: Node): Node[] {
  const own = node.type === 'Text' ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap((c) => (typeof c === 'string' ? [] : texts(c)))];
}

describe('Arsenal', () => {
  it('keeps locked rows readable: no fade, and every line at 4.5:1 or more', async () => {
    await render(<Arsenal best={0} streak={0} pick={null} onEquip={() => {}} />);
    const rows = screen.getAllByRole('button').filter((b) => b.props.accessibilityState?.disabled);
    // Best 0: every weapon but the first is locked.
    expect(rows).toHaveLength(WEAPONS.length - 1);
    for (const row of rows) {
      const rowStyle = StyleSheet.flatten(row.props.style as never) as { opacity?: number } | undefined;
      expect(rowStyle?.opacity ?? 1).toBe(1);
      const lines = texts(row as unknown as Node);
      expect(lines.length).toBeGreaterThanOrEqual(3);
      for (const line of lines) {
        const { color, opacity } = StyleSheet.flatten(line.props.style as never) as { color: string; opacity?: number };
        expect(opacity ?? 1).toBe(1);
        for (const surface of SURFACES) expect(contrast(color, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
