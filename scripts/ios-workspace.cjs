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

module.exports = { IOS, PARK, NAMES, parkedPath, planIosSwitch };
