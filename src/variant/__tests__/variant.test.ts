// The runtime variant: unset is Win Zero; EXPO_PUBLIC_APP_VARIANT=plus is Win Zero Plus, named as
// app.config.ts names it.
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { PLUS } from '../../../app.config';

const saved = process.env.EXPO_PUBLIC_APP_VARIANT;

afterEach(() => {
  if (saved === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = saved;
});

function load(variant: string | undefined): typeof import('..') {
  if (variant === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = variant;
  let mod: typeof import('..') | undefined;
  jest.isolateModules(() => {
    mod = require('..');
  });
  return mod!;
}

describe('variant', () => {
  it('is Win Zero unless the build says Plus', () => {
    for (const v of [undefined, '', 'free']) {
      const free = load(v);
      expect(free.VARIANT).toBe('free');
      expect(free.IS_PLUS).toBe(false);
      expect(free.APP_NAME).toBe('Win Zero');
      expect(free.APP_WORDMARK).toBe('WIN ZERO');
    }
  });

  it('is Win Zero Plus in a Plus build, with the name its config gives it', () => {
    const plus = load('plus');
    expect(plus.VARIANT).toBe('plus');
    expect(plus.IS_PLUS).toBe(true);
    expect(plus.APP_NAME).toBe(PLUS.name);
    expect(plus.APP_WORDMARK).toBe('WIN ZERO PLUS');
  });
});
