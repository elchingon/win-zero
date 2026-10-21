// Win Zero and Win Zero Plus each keep their own Xcode project (scripts/prebuild.mjs). Both build in
// ios/, because pod install writes absolute paths into the folder and Expo's autolinking looks for
// <root>/ios, so a project only works where it was installed. The app not being built waits in
// .ios-parked/<free|plus>/, untouched, with its Pods, signing, build number and Xcode state, and
// comes back on the next switch.
// The pure parts, in CommonJS so both the script and jest can load them.

const IOS = 'ios';
const PARK = '.ios-parked';
const VARIANTS = ['free', 'plus'];
const NAMES = { free: 'Win Zero', plus: 'Win Zero Plus' };

/** Where an app's project waits while the other app's is in ios/. Relative to the project root. */
const parkedPath = (variant) => `${PARK}/${variant}`;

/**
 * The renames that put `want`'s project in ios/, in order: the app there now goes to
 * .ios-parked/<it>, then `want`'s comes back from .ios-parked/<want> if it was parked. Paths are
 * relative to the project root. Refuses, naming both folders, rather than rename over a project.
 * @param {{ active: string | null, parked: { free: boolean, plus: boolean } }} state `active` is the
 *   app ios/ was made for (its marker), or null when there's no ios/.
 * @param {'free' | 'plus'} want
 * @returns {{ moves: { from: string, to: string }[], parked: 'free' | 'plus' | null, restored: boolean }}
 */
function planIosSwitch({ active, parked }, want) {
  if (!VARIANTS.includes(want)) throw new Error(`No app called "${want}".`);
  if (active !== null && !VARIANTS.includes(active)) {
    throw new Error(`ios/ is marked as "${active}", neither free nor plus. Delete ios/ and run this again.`);
  }
  if (active === want) {
    if (parked[want]) {
      throw new Error(
        `Both ios/ and ${parkedPath(want)}/ hold ${NAMES[want]}'s Xcode project. Delete the one you don't need, then run this again.`,
      );
    }
    return { moves: [], parked: null, restored: false };
  }
  const moves = [];
  if (active !== null) {
    if (parked[active]) {
      throw new Error(
        `ios/ holds ${NAMES[active]}'s Xcode project, and so does ${parkedPath(active)}/. Delete the one you don't need, then run this again.`,
      );
    }
    moves.push({ from: IOS, to: parkedPath(active) });
  }
  if (parked[want]) moves.push({ from: parkedPath(want), to: IOS });
  return { moves, parked: active, restored: parked[want] };
}

/**
 * Info.plist's version and build number, as the build settings Xcode's General tab shows and edits.
 * Prebuild writes both as plain values from the config (the build number is always 1 here), while
 * the General tab showed the template's MARKETING_VERSION of 1.0.
 */
const VERSION_SETTINGS = { CFBundleShortVersionString: '$(MARKETING_VERSION)', CFBundleVersion: '$(CURRENT_PROJECT_VERSION)' };

/** The <string> value of `key` in a plist's XML: groups 1 and 3 surround the value. */
const plistString = (key) => new RegExp(`(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`);

/**
 * Points Info.plist's version and build number at Xcode's build settings, and returns the version
 * prebuild had written there from app.json (or PLUS.version) for MARKETING_VERSION. The build number
 * stays wherever CURRENT_PROJECT_VERSION says, which prebuild never touches, so one set in Xcode
 * carries over.
 * @param {string} plist Info.plist's XML, just after prebuild
 * @returns {{ plist: string, version: string }}
 */
function pointVersionsAtSettings(plist) {
  const current = plist.match(plistString('CFBundleShortVersionString'))?.[2];
  if (current === undefined) throw new Error('Info.plist has no CFBundleShortVersionString.');
  if (current.startsWith('$(')) throw new Error(`Info.plist's version is ${current}, not the one prebuild writes from the config.`);
  let out = plist;
  for (const [key, setting] of Object.entries(VERSION_SETTINGS)) {
    const entry = plistString(key);
    if (!entry.test(out)) throw new Error(`Info.plist has no ${key}.`);
    out = out.replace(entry, (_, open, _value, close) => `${open}${setting}${close}`);
  }
  return { plist: out, version: current };
}

/**
 * Sets MARKETING_VERSION in the app's project.pbxproj (its Debug and Release configs; Pods are a
 * project of their own).
 * @param {string} pbxproj
 * @param {string} version
 */
function setMarketingVersion(pbxproj, version) {
  const setting = /(\bMARKETING_VERSION = )[^;]*;/g;
  if (!setting.test(pbxproj)) throw new Error('project.pbxproj has no MARKETING_VERSION.');
  const value = /^[\w.]+$/.test(version) ? version : JSON.stringify(version);
  return pbxproj.replace(setting, (_, head) => `${head}${value};`);
}

module.exports = { IOS, PARK, NAMES, parkedPath, planIosSwitch, pointVersionsAtSettings, setMarketingVersion };
