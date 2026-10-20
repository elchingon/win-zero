// app.config.ts: the free app gets app.json exactly as written, and Win Zero Plus gets its own
// identity and art without a single path back into the free app's brand folder.
import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from '@jest/globals';
import type { ConfigContext, ExpoConfig } from 'expo/config';

import { THEME_IDS } from '@/engine';

import makeConfig, { assetPaths, PLUS, PLUS_ICONS, readVariant, withPlus } from '../../../app.config';
import appJson from '../../../app.json';

const root = path.resolve(__dirname, '../../..');
const base = appJson.expo as unknown as ExpoConfig;
const context = { config: base, projectRoot: root } as unknown as ConfigContext;
const saved = process.env.EXPO_PUBLIC_APP_VARIANT;
const ICON_PLUGIN = './modules/app-icons/app.plugin.js';

interface IconOption {
  name: string;
  ios: Record<'light' | 'dark' | 'tinted', string>;
  android: Record<'foregroundImage' | 'backgroundImage' | 'monochromeImage', string>;
}
/** The options a config gives the app-icons plugin, or undefined when it doesn't use it. */
function iconOptions(config: ExpoConfig): { icons: IconOption[] } | undefined {
  const entry = config.plugins?.find((p) => Array.isArray(p) && p[0] === ICON_PLUGIN);
  return Array.isArray(entry) ? (entry[1] as { icons: IconOption[] }) : undefined;
}

afterEach(() => {
  if (saved === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = saved;
});

describe('readVariant', () => {
  it('reads unset, empty and free as the free app', () => {
    expect(readVariant(undefined)).toBe('free');
    expect(readVariant('')).toBe('free');
    expect(readVariant('free')).toBe('free');
    expect(readVariant(' plus ')).toBe('plus');
  });

  it('refuses anything else, so a typo never builds the wrong app', () => {
    expect(() => readVariant('Plus')).toThrow('EXPO_PUBLIC_APP_VARIANT');
    expect(() => readVariant('pro')).toThrow('EXPO_PUBLIC_APP_VARIANT');
  });
});

describe('the free app', () => {
  it('is app.json exactly, unset or free', () => {
    delete process.env.EXPO_PUBLIC_APP_VARIANT;
    expect(makeConfig(context)).toBe(base);
    process.env.EXPO_PUBLIC_APP_VARIANT = 'free';
    expect(makeConfig(context)).toBe(base);
  });
});

describe('Win Zero Plus', () => {
  const plus = withPlus(base, root);

  it('is chosen by the variant', () => {
    process.env.EXPO_PUBLIC_APP_VARIANT = 'plus';
    expect(makeConfig(context)).toEqual(plus);
  });

  it('has its own name, version, ids and scheme', () => {
    expect(plus.name).toBe('Win Zero Plus');
    expect(plus.version).toBe(PLUS.version);
    expect(plus.scheme).toBe('winzeroplus');
    expect(plus.ios?.bundleIdentifier).toBe('com.e7systems.winzeroplus');
    expect(plus.android?.package).toBe('com.e7systems.winzeroplus');
  });

  it('uses only its own art, and every file is there', () => {
    const paths = assetPaths(plus);
    expect(paths.length).toBe(assetPaths(base).length + 6 * PLUS_ICONS.length);
    for (const p of paths) {
      expect(p.startsWith('./assets/brand-plus/')).toBe(true);
      expect(fs.existsSync(path.join(root, p))).toBe(true);
    }
  });

  it("leaves out the dev client's exp+ scheme, which the free app's slug already claims", () => {
    expect(plus.plugins).toContainEqual(['expo-dev-client', { addGeneratedScheme: false }]);
  });

  it('keeps the rest: the same EAS project, App Group, plugins and privacy answers', () => {
    expect(plus.slug).toBe(base.slug);
    // The folder a move from Win Zero waits in (SPEC 9): both apps must be in the group.
    expect(plus.ios?.entitlements).toEqual(base.ios?.entitlements);
    expect(plus.ios?.entitlements?.['com.apple.security.application-groups']).toEqual(['group.com.e7systems.winzero']);
    expect(plus.extra).toEqual(base.extra);
    expect(plus.ios?.privacyManifests).toEqual(base.ios?.privacyManifests);
    expect(plus.android?.permissions).toEqual(base.android?.permissions);
    expect(plus.android?.blockedPermissions).toEqual(base.android?.blockedPermissions);
    expect(plus.plugins?.slice(0, base.plugins?.length).map((p) => (Array.isArray(p) ? p[0] : p))).toEqual(
      base.plugins?.map((p) => (Array.isArray(p) ? p[0] : p)),
    );
  });

  it('offers an icon per theme, each in every format its own icon has (SPEC 9)', () => {
    const options = iconOptions(plus);
    expect(options?.icons.map((i) => i.name)).toEqual(THEME_IDS);
    expect(PLUS_ICONS).toEqual(THEME_IDS);
    for (const icon of options?.icons ?? []) {
      const files = [...Object.values(icon.ios), ...Object.values(icon.android)];
      expect(Object.keys(icon.ios)).toEqual(['light', 'dark', 'tinted']);
      expect(Object.keys(icon.android)).toEqual(['foregroundImage', 'backgroundImage', 'monochromeImage']);
      for (const f of files) {
        expect(f.startsWith(`./assets/brand-plus/icons/${icon.name}/`)).toBe(true);
        expect(fs.existsSync(path.join(root, f))).toBe(true);
      }
    }
  });

  it('leaves the app icons out of Win Zero, which keeps only its own', () => {
    expect(iconOptions(base)).toBeUndefined();
    expect(JSON.stringify(base)).not.toContain('app-icons');
  });

  it("doesn't touch app.json's config", () => {
    expect(assetPaths(base).every((p) => p.startsWith('./assets/brand/'))).toBe(true);
    expect(base.name).toBe('Win Zero');
  });

  it('names the missing art when a Plus file is gone', () => {
    const broken = { ...base, icon: './assets/brand/nowhere.png' };
    expect(() => withPlus(broken, root)).toThrow('./assets/brand-plus/nowhere.png');
  });
});
