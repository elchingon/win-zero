// The app's config. app.json is Win Zero, and the free app gets it exactly as written.
// EXPO_PUBLIC_APP_VARIANT=plus makes Win Zero Plus instead (SPEC 9): a second app from the same
// code, with its own name, bundle id, URL scheme and art (assets/brand-plus/). EAS profiles ending
// in -plus set it (eas.json), as do the npm scripts ending in :plus. Never set it in .env: the CLI
// loads .env first, so a stray value there would quietly build Plus.
// Keep this file self-contained (no imports from src/): the CLI loads it on its own.
import fs from 'node:fs';
import path from 'node:path';

import type { ConfigContext, ExpoConfig } from 'expo/config';

export type Variant = 'free' | 'plus';

export const PLUS = {
  name: 'Win Zero Plus',
  /** Plus's own marketing version; app.json's belongs to the free app. */
  version: '1.2.3',
  scheme: 'winzeroplus',
  id: 'com.e7systems.winzeroplus',
} as const;

const FREE_BRAND = './assets/brand/';
const PLUS_BRAND = './assets/brand-plus/';

/**
 * Win Zero Plus's alternate home-screen icons, one per theme (SPEC 9), drawn into
 * assets/brand-plus/icons/<theme>/ by npm run gen:brand:plus; the app-icons module switches between
 * them. Never rename or remove one once it has shipped: a phone showing it would lose its launcher entry.
 */
export const PLUS_ICONS = ['classic', 'neon', 'mono', 'pastel', 'ember', 'aurora', 'gold'] as const;

function plusIcon(name: string) {
  const dir = `${PLUS_BRAND}icons/${name}/`;
  return {
    name,
    ios: { light: `${dir}app-store-icon.png`, dark: `${dir}ios-icon-dark.png`, tinted: `${dir}ios-icon-tinted.png` },
    android: {
      foregroundImage: `${dir}android-foreground.png`,
      backgroundImage: `${dir}android-background.png`,
      monochromeImage: `${dir}android-monochrome.png`,
    },
  };
}

/**
 * Config plugins only Plus uses. Their native modules still link into both apps (Expo autolinks
 * by package, not by variant), but only Plus configures and calls them.
 */
const PLUS_ONLY_PLUGINS: NonNullable<ExpoConfig['plugins']> = [
  ['./modules/app-icons/app.plugin.js', { icons: PLUS_ICONS.map(plusIcon) }],
  // Plus's Xcode project pins the variant, so a build made in Xcode (which never has this
  // environment) bundles Plus's JavaScript, not Win Zero's.
  './plugins/xcode-variant.js',
];

export function readVariant(value: string | undefined): Variant {
  const v = value?.trim() ?? '';
  if (v === '' || v === 'free') return 'free';
  if (v === 'plus') return 'plus';
  throw new Error(`EXPO_PUBLIC_APP_VARIANT must be unset, "free" or "plus", not "${value}".`);
}

/** Every brand path in the config (icons, splash and plugin options) moved to Plus's folder. */
function rebrand<T>(value: T): T {
  if (typeof value === 'string') {
    return (value.startsWith(FREE_BRAND) ? PLUS_BRAND + value.slice(FREE_BRAND.length) : value) as T;
  }
  if (Array.isArray(value)) return value.map(rebrand) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrand(v)])) as T;
  }
  return value;
}

/** Every asset path the config names. */
export function assetPaths(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('./assets/')) found.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) assetPaths(v, found);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) assetPaths(v, found);
  }
  return found;
}

export function withPlus(config: ExpoConfig, root: string): ExpoConfig {
  const plus = rebrand(config);
  const result: ExpoConfig = {
    ...plus,
    name: PLUS.name,
    version: PLUS.version,
    scheme: PLUS.scheme,
    ios: { ...plus.ios, bundleIdentifier: PLUS.id },
    android: { ...plus.android, package: PLUS.id },
    plugins: [
      ...(plus.plugins ?? []),
      ...PLUS_ONLY_PLUGINS,
      // expo-dev-client gives every build an exp+<slug> scheme. Both apps share the slug (one EAS
      // project), so Plus leaves it out and keeps its links to winzeroplus://.
      ['expo-dev-client', { addGeneratedScheme: false }],
    ],
  };
  // A missing file (icons included) fails here, with its name, rather than deep in a native build.
  const missing = assetPaths(result).filter((p) => !fs.existsSync(path.join(root, p)));
  if (missing.length > 0) {
    throw new Error(`Win Zero Plus art is missing: ${missing.join(', ')}. Run npm run gen:brand:plus.`);
  }
  return result;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = readVariant(process.env.EXPO_PUBLIC_APP_VARIANT);
  return variant === 'plus' ? withPlus(config as ExpoConfig, __dirname) : (config as ExpoConfig);
};
