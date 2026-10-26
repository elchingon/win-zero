// Play takes an upload only if its version code is higher than every earlier upload of that app.
// Local builds regenerate android/ from the config, which sets none, so every build would be code 1:
// build-android.mjs writes the one given as --version-code into the generated build.gradle.
// The pure parts, in CommonJS so both the script and jest can load them.

/** Play's highest version code. */
const MAX_VERSION_CODE = 2100000000;

/**
 * Takes `--version-code N` (or `--version-code=N`) out of a script's arguments, leaving the rest for
 * Gradle. Throws on a missing or invalid number.
 * @param {string[]} args
 * @returns {{ code: number | null, rest: string[] }}
 */
function takeVersionCode(args) {
  const rest = [];
  let code = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    let raw;
    if (arg === '--version-code') raw = args[++i];
    else if (arg.startsWith('--version-code=')) raw = arg.slice('--version-code='.length);
    else {
      rest.push(arg);
      continue;
    }
    if (raw === undefined || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > MAX_VERSION_CODE) {
      throw new Error(`--version-code takes a whole number from 1 to ${MAX_VERSION_CODE}, not ${JSON.stringify(raw ?? '')}.`);
    }
    code = Number(raw);
  }
  return { code, rest };
}

/**
 * Sets the app's versionCode in a generated android/app/build.gradle.
 * @param {string} gradle
 * @param {number} code
 */
function setVersionCode(gradle, code) {
  const setting = /(\bversionCode )\d+/g;
  const found = gradle.match(setting)?.length ?? 0;
  if (found !== 1) throw new Error(`build.gradle should set versionCode once, not ${found} times.`);
  return gradle.replace(setting, (_, head) => `${head}${code}`);
}

/**
 * The versionName and versionCode a build.gradle sets.
 * @param {string} gradle
 */
function readVersion(gradle) {
  return { name: gradle.match(/\bversionName "([^"]*)"/)?.[1] ?? null, code: Number(gradle.match(/\bversionCode (\d+)/)?.[1] ?? NaN) };
}

module.exports = { MAX_VERSION_CODE, takeVersionCode, setVersionCode, readVersion };
