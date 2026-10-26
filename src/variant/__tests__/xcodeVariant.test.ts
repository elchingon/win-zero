// The xcode-variant config plugin (plugins/xcode-variant.js): Win Zero Plus's ios/.xcode.env, which
// every Xcode build script sources, sets the variant, so a build made in Xcode bundles Plus.
import { describe, expect, it } from '@jest/globals';

import { pinVariant } from '../../../plugins/xcode-variant';

/** The .xcode.env the Expo template writes. */
const TEMPLATE = [
  '# This `.xcode.env` file is versioned and is used to source the environment',
  '# used when running script phases inside Xcode.',
  '',
  '# NODE_BINARY variable contains the PATH to the node executable.',
  'export NODE_BINARY=$(command -v node)',
  '',
].join('\n');
const PIN = 'export EXPO_PUBLIC_APP_VARIANT=plus';

const pins = (text: string) => text.split('\n').filter((line) => line.includes('EXPO_PUBLIC_APP_VARIANT')).length;

describe('pinVariant', () => {
  it('adds the variant after what the template says, keeping the path to node', () => {
    const out = pinVariant(TEMPLATE);
    expect(out.startsWith(TEMPLATE)).toBe(true);
    expect(out).toContain('export NODE_BINARY=$(command -v node)');
    expect(out.trimEnd().endsWith(PIN)).toBe(true);
    expect(out.endsWith('\n')).toBe(true);
  });

  it('says it once, however often prebuild runs', () => {
    const once = pinVariant(TEMPLATE);
    expect(pinVariant(once)).toBe(once);
    expect(pinVariant(pinVariant(once))).toBe(once);
    expect(pins(once)).toBe(1);
  });

  it('replaces any other value, wherever it was', () => {
    const stale = `export EXPO_PUBLIC_APP_VARIANT=free\n${TEMPLATE}EXPO_PUBLIC_APP_VARIANT=pro\n`;
    const out = pinVariant(stale);
    expect(pins(out)).toBe(1);
    expect(out).toContain(PIN);
    expect(out).not.toContain('=free');
    expect(out).not.toContain('=pro');
  });

  it('writes just the pin into an empty file', () => {
    expect(pinVariant('').split('\n')[0]).toMatch(/^# Win Zero Plus/);
    expect(pins(pinVariant(''))).toBe(1);
  });
});
