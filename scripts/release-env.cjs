// What a release build of Win Zero or Win Zero Plus carries from its environment, checked before it
// ships: the privacy and support pages (Settings › About opens them, and App Review looks for the
// privacy one inside the app), and Win Zero Plus's store page, which decides whether Win Zero offers
// the move (SPEC 9). EAS builds take these from their profile's env in eas.json
// (scripts/check-release.mjs); local release builds bundle whatever Expo reads from the .env files
// (scripts/build-android.mjs, and npm run check:release:ios before an Xcode archive).
// The pure parts, in CommonJS so both the scripts and jest can load them.
const { createRequire } = require('node:module');

const LINKS = ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_SUPPORT_URL'];
const PLUS_STORE_URL = { ios: 'EXPO_PUBLIC_PLUS_STORE_URL_IOS', android: 'EXPO_PUBLIC_PLUS_STORE_URL_ANDROID' };
const STORES = { ios: 'the App Store', android: 'Google Play' };
/** Win Zero Plus's own pages. Anything else, such as QA's stand-in https://winzero.app/, isn't one. */
const PLUS_PAGES = {
  ios: {
    pattern: /^https:\/\/apps\.apple\.com\/(?:[a-z]{2}\/)?app\/(?:[\w-]+\/)?id\d+$/,
    example: "https://apps.apple.com/app/id<Plus's Apple ID>",
  },
  android: {
    pattern: /^https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.e7systems\.winzeroplus$/,
    example: 'https://play.google.com/store/apps/details?id=com.e7systems.winzeroplus',
  },
};

const isHttps = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * What's wrong with a release build's env (`errors`, which stop it), and what the build will do
 * with it (`notes`): whether Win Zero offers the move, or where Plus's "Update Win Zero Plus" goes.
 * @param {Record<string, string | undefined>} env
 * @param {{ variant: 'free' | 'plus', platform: 'ios' | 'android' }} build
 * @returns {{ errors: string[], notes: string[] }}
 */
function checkReleaseEnv(env, { variant, platform }) {
  const value = (name) => env[name]?.trim() ?? '';
  const errors = [];
  const notes = [];
  for (const name of LINKS) {
    if (!isHttps(value(name))) {
      errors.push(`${name} must be its published https page, not ${JSON.stringify(value(name))}.`);
    }
  }
  const name = PLUS_STORE_URL[platform];
  const page = value(name);
  const { pattern, example } = PLUS_PAGES[platform];
  if (page && !pattern.test(page)) {
    errors.push(
      `${name} is ${JSON.stringify(page)}, which isn't Win Zero Plus's page on ${STORES[platform]}. ` +
        `Set ${example}, or leave it empty.`,
    );
  } else if (variant === 'free') {
    notes.push(
      page
        ? `Win Zero offers Move to Win Zero Plus, opening ${page} when Plus isn't installed. ` +
            `Release this build only once Win Zero Plus is live on ${STORES[platform]}.`
        : `Win Zero hides Move to Win Zero Plus: ${name} is empty.`,
    );
  } else {
    notes.push(page ? `Update Win Zero Plus opens ${page}.` : `Win Zero Plus hides Update Win Zero Plus: ${name} is empty.`);
  }
  return { errors, notes };
}

/**
 * Prints a check's result under `title`. Errors stop the build when `strict`; otherwise they're
 * warnings, for a build that isn't going to a store. Returns whether the build may go on.
 * @param {{ errors: string[], notes: string[] }} result
 * @param {{ title: string, strict: boolean }} options
 */
function report({ errors, notes }, { title, strict }) {
  const lines = [...errors.map((e) => `  ${strict ? 'Stop' : 'Warning'}: ${e}`), ...notes.map((n) => `  ${n}`)];
  (errors.length > 0 ? console.error : console.log)(`${title}\n${lines.join('\n')}`);
  if (errors.length > 0 && !strict) console.error('  Fine for a test build. A build for the store stops here.');
  return !(strict && errors.length > 0);
}

/**
 * The env a local release bundle is built with: the shell's own values, then the .env files Expo
 * reads in production mode. Read with the @expo/env that Expo's CLI itself uses, so the two agree.
 * @param {string} projectRoot
 * @param {Record<string, string | undefined>} [systemEnv]
 */
function localReleaseEnv(projectRoot, systemEnv = process.env) {
  const fromExpo = createRequire(require.resolve('expo/package.json', { paths: [projectRoot] }));
  const fromCli = createRequire(fromExpo.resolve('@expo/cli/package.json'));
  const { parseProjectEnv } = fromCli('@expo/env');
  const { env } = parseProjectEnv(projectRoot, { mode: 'production', silent: true, systemEnv });
  return { ...env, ...systemEnv };
}

module.exports = { LINKS, PLUS_STORE_URL, checkReleaseEnv, report, localReleaseEnv };
