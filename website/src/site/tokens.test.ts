import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { colors } from '@/theme/tokens';

describe('tokens.css', () => {
  it('has every app color, with the same value', () => {
    const css = fs.readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    for (const [name, hex] of Object.entries(colors)) {
      const variable = `--${name.replace(/([A-Z0-9])/g, '-$1').toLowerCase()}`;
      const value = new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{6});`).exec(css)?.[1];
      expect({ variable, value: value?.toUpperCase() }).toEqual({ variable, value: hex.toUpperCase() });
    }
  });
});
