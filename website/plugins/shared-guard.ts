// The website shares the app's rules, store and game code from ../src, so the two can't drift.
// This plugin keeps that sharing safe: it fails the build on any native import (React Native,
// Expo, Skia at runtime) and on any ../src file that isn't on the allowlist below.
import path from 'node:path';

import type { Plugin } from 'vite';

/** Paths under the app's src/ that the website may import. Each is pure TypeScript. */
export const SHARED_ALLOWLIST = [
  'engine/**',
  'game/sim/**',
  'game/draw/**',
  'game/cues.ts',
  'game/look.ts',
  'game/result.ts',
  'game/shareText.ts',
  'store/createAppStore.ts',
  'store/migrate.ts',
  'store/notice.ts',
  'store/types.ts',
  'store/id.ts',
  'store/lifecycle.ts',
  'store/limits.ts',
  'store/select.ts',
  'lib/format.ts',
  'lib/calendar.ts',
  'theme/tokens.ts',
  'ui/home/stakes.ts',
  'ui/home/routing.ts',
  'ui/copy/**',
  'dev/seedRun.ts',
  'dev/demo.ts',
] as const;

/** Packages that only exist in the native app. Type-only imports never reach the resolver. */
const NATIVE_ONLY = /^(react-native|expo|@expo|@react-native|@react-native-async-storage|@shopify\/react-native-skia)([-/].*)?$/;

function globToRegExp(glob: string): RegExp {
  const pattern = glob
    .split('**')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*'))
    .join('.*');
  return new RegExp(`^${pattern}$`);
}

const ALLOWED = SHARED_ALLOWLIST.map(globToRegExp);

/** Whether `relative` (a path under src/, with forward slashes) may be imported by the website. */
export function isShared(relative: string): boolean {
  if (relative.includes('__tests__/')) return false;
  return ALLOWED.some((re) => re.test(relative));
}

export function isNativeOnly(source: string): boolean {
  return NATIVE_ONLY.test(source);
}

export function sharedGuard(appSrc: string): Plugin {
  const root = path.resolve(appSrc);
  return {
    name: 'win-zero:shared-guard',
    enforce: 'pre',
    resolveId(source, importer) {
      if (isNativeOnly(source)) {
        this.error(`"${source}" is native-only and can't run on the website (imported by ${importer ?? 'an entry'}).`);
      }
      return null;
    },
    load(id) {
      const file = id.split('?')[0] ?? id;
      if (!file.startsWith(root + path.sep)) return null;
      const relative = path.relative(root, file).split(path.sep).join('/');
      if (!isShared(relative)) {
        this.error(
          `src/${relative} isn't on the website's shared allowlist (website/plugins/shared-guard.ts). ` +
            'Move the pure part into a shared module rather than importing app code.',
        );
      }
      return null;
    },
  };
}
