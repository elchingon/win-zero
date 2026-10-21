// Release guard, run by EAS before every build (the eas-build-pre-install npm script), and by hand
// before archiving in Xcode: npm run check:release:ios, or check:release:ios:plus.
// - A profile ending in -plus builds Win Zero Plus, and only those do: each sets
//   EXPO_PUBLIC_APP_VARIANT=plus in its env (eas.json), so a profile that forgot it, or a free one
//   that picked it up, stops here instead of building the wrong app.
// - A production build (production, production-plus, or --local) stops unless the privacy and
//   support pages are https URLs, since App Review needs a working privacy policy link inside the
//   app, and unless any Plus store page is Win Zero Plus's real one (scripts/release-env.cjs). It
//   also says whether Win Zero will offer the move. On EAS they come from the profile's `env` in
//   eas.json (the gitignored .env isn't uploaded); --local reads them as the release bundle will.
// Other profiles pass.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildVariant } from './prebuild.mjs';
import { checkReleaseEnv, localReleaseEnv, report } from './release-env.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAMES = { free: 'Win Zero', plus: 'Win Zero Plus' };

if (process.argv[2] === '--local') {
  const platform = process.argv[3];
  if (platform !== 'ios' && platform !== 'android') {
    console.error('Usage: node scripts/check-release.mjs --local ios|android');
    process.exit(1);
  }
  const variant = buildVariant();
  const result = checkReleaseEnv(localReleaseEnv(root), { variant, platform });
  const ok = report(result, { title: `${NAMES[variant]} release build (${platform}), from .env:`, strict: true });
  process.exit(ok ? 0 : 1);
}

const profile = process.env.EAS_BUILD_PROFILE ?? '';
const plus = (process.env.EXPO_PUBLIC_APP_VARIANT?.trim() ?? '') === 'plus';

if (profile && profile.endsWith('-plus') !== plus) {
  console.error(
    profile.endsWith('-plus')
      ? `The ${profile} profile builds Win Zero Plus: set EXPO_PUBLIC_APP_VARIANT to "plus" in its env in eas.json.`
      : `The ${profile} profile builds Win Zero, but EXPO_PUBLIC_APP_VARIANT is "plus". Use ${profile}-plus for Win Zero Plus.`,
  );
  process.exit(1);
}

if (/^production(-|$)/.test(profile)) {
  const platform = process.env.EAS_BUILD_PLATFORM === 'ios' ? 'ios' : 'android';
  const variant = plus ? 'plus' : 'free';
  const ok = report(checkReleaseEnv(process.env, { variant, platform }), {
    title: `${NAMES[variant]} ${profile} build (${platform}), from build.${profile}.env in eas.json:`,
    strict: true,
  });
  if (!ok) process.exit(1);
}
