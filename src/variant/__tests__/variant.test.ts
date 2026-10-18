// The runtime variant: unset is Win Zero; EXPO_PUBLIC_APP_VARIANT=plus is Win Zero Plus, named as
// app.config.ts names it.
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import appJson from '../../../app.json';
import { PLUS } from '../../../app.config';

const KEYS = ['EXPO_PUBLIC_APP_VARIANT', 'EXPO_PUBLIC_PLUS_STORE_URL_IOS', 'EXPO_PUBLIC_PLUS_STORE_URL_ANDROID'] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
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

describe('the move between the apps (SPEC 9)', () => {
  it('sends from Win Zero and takes in to Plus', () => {
    expect(load(undefined).FEATURES).toEqual({ moveOut: true, importIn: false });
    expect(load('plus').FEATURES).toEqual({ moveOut: false, importIn: true });
  });

  it('names the other app as each app’s config does', () => {
    const free = appJson.expo;
    expect(load(undefined).PEER).toEqual({ scheme: PLUS.scheme, package: PLUS.id, activity: `${PLUS.id}.MainActivity` });
    expect(load('plus').PEER).toEqual({
      scheme: free.scheme,
      package: free.android.package,
      activity: `${free.android.package}.MainActivity`,
    });
  });

  it('shares the App Group both apps are given', () => {
    expect(appJson.expo.ios.entitlements['com.apple.security.application-groups']).toEqual([load(undefined).APP_GROUP]);
  });

  it('knows Plus’s store page only once it is set for this platform', () => {
    delete process.env.EXPO_PUBLIC_PLUS_STORE_URL_IOS;
    delete process.env.EXPO_PUBLIC_PLUS_STORE_URL_ANDROID;
    expect(load(undefined).PLUS_STORE_URL).toBeNull();
    process.env.EXPO_PUBLIC_PLUS_STORE_URL_ANDROID = 'https://play.google.com/store/apps/details?id=x';
    expect(load(undefined).PLUS_STORE_URL).toBeNull(); // tests run as iOS
    process.env.EXPO_PUBLIC_PLUS_STORE_URL_IOS = ' https://apps.apple.com/app/id1 ';
    expect(load(undefined).PLUS_STORE_URL).toBe('https://apps.apple.com/app/id1');
  });
});
