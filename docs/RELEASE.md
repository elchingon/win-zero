# Releasing Win Zero

The path from this branch to both stores, and the device QA to pass first. The store copy and form
answers are in `docs/store/`.

## 1. Before the first build

- [ ] **Update the Expo patches.** `npx expo-doctor` flags six SDK 57 patch releases (expo,
  expo-asset, expo-constants, expo-linking, expo-notifications, expo-router).
  - Run `npx expo install --fix`, then rebuild the dev client.
  - Some are native modules, so do it on its own, before the QA builds.
- [ ] **Check the two pages are live on winzero.app.**
  - The website (`website/`, deployed by Cloudflare Pages) builds them from
    `docs/store/privacy-policy.md` and `docs/store/support.md`. See `website/README.md`.
  - `curl -sI https://winzero.app/privacy` and `https://winzero.app/support` both return 200,
    with no redirect.
  - Set both URLs, which Settings → About opens, as `EXPO_PUBLIC_PRIVACY_URL` and
    `EXPO_PUBLIC_SUPPORT_URL`:
    - EAS builds: `eas env:create --environment production --visibility plaintext --name
      EXPO_PUBLIC_PRIVACY_URL --value https://winzero.app/privacy`, and the same for
      `EXPO_PUBLIC_SUPPORT_URL` with `https://winzero.app/support`.
      EAS doesn't upload the gitignored `.env`. A production build fails until both are https
      URLs (`scripts/check-release.mjs`).
    - Local runs: copy `.env.example` to `.env` and fill it in.
- [ ] **Optional: iOS dark and tinted icons.** The brand set has one iOS icon, which iOS 18 uses in
  every appearance. To add variants, render them in `scripts/gen-brand.mjs` and set
  `ios.icon: { light, dark, tinted }` in `app.json`.

## 2. Store records and credentials

- [ ] **App Store Connect → Apps → New App.**
  - Fields: iOS, name **Win Zero**, bundle ID `com.e7systems.winzero`, any SKU, and a primary
    language.
  - Copy the app's **Apple ID** (a number) into `eas.json` under
    `submit.production.ios.ascAppId`.
- [ ] **Play Console (organization account) → Create app.**
  - Fields: **Win Zero**, App, Free, and the declarations.
- [ ] **Play service account.**
  1. Create it in Google Cloud.
  2. Invite it in Play Console → Users and permissions, with release rights for this app.
  3. Upload its JSON key to EAS: `eas credentials` → Android → Google Service Account.
  4. Don't commit the key.

## 3. Build and test

- [ ] `eas build --profile production --platform all`. Build numbers increment remotely.
- [ ] **Android:** `eas submit --profile production --platform android` sends the build to the
  **internal testing** track. Add testers in Play Console → Testing → Internal testing.
- [ ] **iOS:** `eas submit --profile production --platform ios` sends it to **TestFlight**. Add
  internal testers.
- [ ] Run the QA matrix below on TestFlight and internal-track builds. A `preview` build works
  too.

## 4. Listings and forms

- [ ] **Listing copy:** paste from `docs/store/listing.md`, with the URLs filled in.
- [ ] **Graphics:**
  - Icon: `assets/brand/google-play-icon.png`
  - Feature graphic: `assets/brand/play-feature-graphic.png`
  - Screenshots: from `docs/store/screenshots.md`
- [ ] **Forms:** App Privacy, Data safety, Health apps, content rating, target audience, ads and
  app access, all from `docs/store/answers.md`.
- [ ] **Accessibility claims:** the descriptions name VoiceOver/TalkBack, larger text and reduced
  motion. Keep those lines only if they pass the QA below.

## 5. Release

- [ ] **iOS:** submit for review, with the App Review notes from `answers.md`.
- [ ] **Android:** promote internal → production. A staged rollout (for example 20%) is a gentle
  start.
- [ ] **After launch:** watch App Store Connect crashes and Play vitals for the first week. There's
  no crash SDK in v1.

---

## Win Zero Plus

Win Zero Plus (SPEC 9) is built from this repo. `EXPO_PUBLIC_APP_VARIANT=plus` makes
`app.config.ts` give it its own name, bundle id (`com.e7systems.winzeroplus`), scheme
(`winzeroplus`) and art (`assets/brand-plus/`, from `npm run gen:brand:plus`). Every EAS profile
has a `-plus` twin that sets it, and `scripts/check-release.mjs` stops a build whose profile and
variant disagree. `npm run check:variants` (also in CI) checks both apps' configs.

- [ ] **Dev client:** `eas build --profile development-plus --platform ios|android`, then
  `npm run start:plus`. A dev client runs whichever app the dev server was started for, so start
  it with `start:plus` for the Plus dev client.
- [ ] **Store records:**
  - App Store Connect → New App: **Win Zero Plus**, bundle ID `com.e7systems.winzeroplus`. Copy its
    Apple ID into `eas.json` under `submit.production-plus.ios.ascAppId`.
  - Play Console → Create app: **Win Zero Plus**, App, **Paid**.
- [ ] **Builds:** `eas build --profile production-plus --platform all --auto-submit-with-profile
  production-plus`, or `eas submit --profile production-plus --id <build id>`. Never `--latest`:
  it can pick the other app's build.
- [ ] **Local builds:**
  - Android: `npm run build:android:plus`, or `build:android:plus:upload` with Plus's own upload
    key in `.env.signing.plus`. Install with `npm run install:android:plus`.
  - iOS: `npm run open:ios:plus`.
  - These regenerate `android/` or `ios/` from clean when it was last generated for the other app
    (`scripts/prebuild.mjs`). `npm run android|ios` (`expo run`) doesn't check: after building the
    other app, run `npx expo prebuild --clean` first.
- [ ] **Store versions:** Plus is never on an older `STORE_VERSION` (`src/store/types.ts`) than the
  free app, so a move from the free app can always be read. When a release raises it, release Plus
  first, then the free app.
- [ ] **App Group (the move on iPhone, SPEC 9):** both apps carry the entitlement
  `group.com.e7systems.winzero` (`ios.entitlements` in `app.json`; `npm run check:variants` checks
  both). Register it once, by either route:
  - Apple Developer → Identifiers → App Groups → **+**, id `group.com.e7systems.winzero`. Then on
    both App IDs (`com.e7systems.winzero` and `com.e7systems.winzeroplus`) turn on **App Groups**,
    assign the group, and regenerate their provisioning profiles.
  - Or let EAS do it: the next `eas build` for each app syncs capabilities, enabling App Groups
    and registering the group. That needs an Apple sign-in, so run the build from your machine
    (`EXPO_NO_CAPABILITY_SYNC=1` skips the sync).

  Every build made before this needs rebuilding, dev clients included. A release build without the
  group can't move (it says so), and a dev build without it puts the move in the link instead.
- [ ] **Plus's store pages:** `EXPO_PUBLIC_PLUS_STORE_URL_IOS` and `_ANDROID`. While they're unset, the
  free app hides Settings → About → **Move to Win Zero Plus**. If Plus isn't installed, the move
  opens the page. Plus opens its own page for "Update Win Zero Plus".
  - The `preview` profile (and `preview-plus`) sets the Play page and a stand-in iOS page
    (`https://winzero.app/`) for QA. Local runs take them from `.env` (see `.env.example`).
  - For release, set both in the `production` profile's env (`production-plus` inherits them):
    `https://apps.apple.com/app/id<Plus's Apple ID>` and
    `https://play.google.com/store/apps/details?id=com.e7systems.winzeroplus`.
- [ ] **Release order for the move:** release **Plus 1.0 first** and wait until it's live in both
  stores. Then release **free 1.2**, with the Plus store URLs set. A free build with the URLs set
  before Plus is live would offer a move to an app nobody can install.

### Building and testing both apps

- **Dev builds, both on one phone:**
  1. `eas build --profile development --platform <ios|android>` and `eas build --profile
     development-plus --platform <ios|android>`. A simulator needs the `development-simulator`
     profiles.
  2. Copy `.env.example` to `.env`; it sets the Plus store URLs, so the Move row shows.
  3. Run one dev server per app on its own port: `npm start -- --port 8081` for Win Zero, and
     `npm run start:plus -- --port 8082` for Plus. In each dev client, connect to its own server.
     A dev client runs whatever JavaScript its server sends, so Plus's must be `start:plus`.
- **Without Metro:** `preview` and `preview-plus` builds (both set the store URLs). On Android, local
  release builds also work: `npm run build:android && npm run install:android`, then `npm run
  build:android:plus && npm run install:android:plus`.
- **Moving by hand:**
  - Win Zero: Settings → About → **Move to Win Zero Plus** → **Move**.
  - Or open the links yourself:
    - `xcrun simctl openurl booted "winzeroplus://import?t=<id>"` with a dev build's move in the
      link as `&d=wz1.…`
    - `adb shell am start -a android.intent.action.VIEW -d "winzero://moved?t=<id>"
      com.e7systems.winzero`
- **Themes before Settings › Themes:** a Plus dev client plays a practice round in any theme, earned
  or not: `winzeroplus://play?practice=60&theme=<id>`, where the id is `classic`, `neon`, `mono`,
  `pastel`, `ember`, `aurora` or `gold` (QA row 22). Win Zero ignores `&theme`.
- **Game modes before Settings › Games:** a Plus dev client plays a practice round in any game mode,
  `winzeroplus://play?practice=60&mode=<id>`, where the id is `catch`, `orbit`, `slice` or `breaker`,
  and `&theme=` works alongside (QA rows 23–26). A `perf-plus` build does the same in release mode.
  Win Zero ignores `&mode`.

---

## Website (winzero.app)

The website deploys on its own: Cloudflare Pages builds `website/` on every push to `main`, and
a preview for every pull request. It doesn't wait on, or trigger, an EAS build. Setup and the
Cloudflare settings are in `website/README.md`.

- [ ] **First deploy:** connect the repo in Cloudflare Pages, add the `winzero.app` domain, and
  check the curl list at the end of `website/README.md` (200s for `/privacy` and `/support`, the
  security headers, a 404 for unknown paths).
- [ ] **Each change:** CI's `website` job passes (build, verify, typecheck, lint, tests). Check the
  pull request's preview link on a phone: set up, check in, play a round, and the demo controls.
- [ ] **When the apps are live:** put the App Store and Google Play links in
  `website/partials/stores.html`.
- [ ] **Policy or support changes:** edit `docs/store/*.md` and update the policy's effective date.
  The website picks them up on its next deploy.

## QA matrix

Run each row on one iPhone and one mid-range Android. Rows marked _dev_ need the development build
and its debug tools. The others use a TestFlight, internal or `preview` build.

| # | Area | Steps | Expect |
|---|---|---|---|
| 1 | **Live DST change** (US fall-back, **Sun Nov 1, 2026**) | Leave the **Sat Oct 31** evening check-in unanswered. Answer it from the **9:00 AM Sun Nov 1** morning reminder. Then check in on the evening of **Nov 1**. | Reminders arrive at 9:00 AM and 8:00 PM on the new clock. The streak goes up twice. The calendar shows Oct 31 and Nov 1 as Yes. |
| 2 | **Time-zone travel** | Change the phone's time zone (for example Denver → New York → Tokyo) and reopen the app each time. | The check-in card and Settings show times on the phone's clock. Reminders are rescheduled for the new zone. No day is skipped or doubled. |
| 3 | **Multi-week absence** _dev_ | **Jump to day 10**. Then, with Home open, debug clock **+7 days** three times. | The first week shows nothing (free days). After that, each jump shows its news once (Slipping, Shielded or Reset, as the rules give), in kind words. Once the slide reaches its end, "Reminders are paused" shows and the pending count drops to the weekly nudges. A Yes brings daily reminders back. |
| 4 | **Missed days + a notification Yes** _dev_ | **Jump to day 10**, then go to Settings. Debug clock **+8 days**, then **Send test check-in**. Background the app, and tap **Yes** on the notification. | Home opens with the round ready. "While you were away" shows once and says the Yes stopped the slide. Nothing covers anything. **Play now** opens the round. |
| 5 | **Notification actions** (regression) | **Send test check-in** with the app killed, in the background, and in the foreground on Settings. Tap Yes once and Not today once, in each state. | Yes opens Home with "Your Day N round is ready"; it doesn't start the round. Not today opens its notice. Android clears the notification. |
| 6 | **Performance** | `eas build --profile perf --platform android`, then open `winzero://play?practice=60` and `winzero://play?practice=1000`, e.g. `adb shell am start -a android.intent.action.VIEW -d "winzero://play?practice=60"`. | About 60 FPS on the frame meter, with the worst frame under about 25 ms. A bomb over a full board still shows the three finale shockwaves. Holding fires, dragging aims and lifting stops, as before (touches reach the round as pointer calls since game modes). |
| 7 | **Reduce motion, silent switch, haptics off** | Turn on OS Reduce Motion. Flip the iPhone silent switch. Turn haptics off in Settings. Play a round each time. | Less shake and fewer particles. No sound when silenced. No buzz with haptics off. |
| 8 | **VoiceOver / TalkBack** | Home: swipe through, and use heading navigation. Calendar: change months. Arsenal, the check-in card, and a round. | Headings: Daily goal, Arsenal, History. The calendar reads a month summary and "today". Buttons say what they'd do. **Finish round** clears a round (also the VoiceOver two-finger double-tap). "Round cleared" is announced, then focus lands on "N zeros down". |
| 9 | **Largest text size** | iOS: Accessibility → Larger Text at maximum. Android: font size and display size at maximum. | Home and Settings stay readable, and the check-in and result buttons stack. The result sheet scrolls rather than running off the screen. The HUD stays in its bands. |
| 10 | **Icons and splash** | Home screen in light and dark (and tinted on iOS 18). Android themed icons on. A reminder in the status bar. Cold launch. | The brand zero shows everywhere, and the Android themed icon follows the wallpaper color. The status-bar icon is a full-size white zero. The launch splash plays, then Home. |
| 11 | **Release permissions** | `bundletool dump manifest --bundle app.aab` (or `aapt dump permissions` on a preview APK). | No storage or SYSTEM_ALERT_WINDOW permissions, and no exact-alarm permission. |
| 12 | **Fresh install and erase** | Install fresh, go through Setup and allow notifications. Then Settings → Erase all data. | The permission explanation shows before the OS prompt. After erasing, Setup shows and the pending count is 0. |
| 13 | **Answering the next evening** _dev_ | Leave a check-in unanswered. Move the debug clock to 9:00 PM the next day, then answer. Leave the next one unanswered and move the clock past the following midnight. | At 9:00 PM, Home asks about yesterday and says "Open until the end of today". That evening's notification has no buttons, and tapping it opens Home. After answering yesterday, today's card shows. Past midnight, the unanswered day is recorded as missed, and the day after it is still open. |
| 14 | **Changing the check-in time** | Leave yesterday's check-in unanswered. In Settings, set the check-in time a few minutes from now, then lock the phone. | Settings says "Next check-in: today at …" with the new time. The notification arrives then, without buttons while yesterday is open, and tapping it opens Home on yesterday's card. |
| 15 | **Move: 1,000 days** _dev_ | Win Zero: **Jump to day 1000**. Settings → About → **Move to Win Zero Plus** → **Move**. In Plus, read the preview, tap **Bring it over**, and allow notifications. | Plus opens on the preview: the goal, streak 1000 and its Yes days, the credits, and the settings. Nothing changes until Bring it over. Then Win Zero opens with "Your goals now live in Win Zero Plus". Plus's Home shows the same streak, history, weapons and credits, and its reminders are scheduled. |
| 16 | **Move: Win Zero goes quiet** _dev_ | After row 15, check Win Zero's debug pending count. Leave a Win Zero reminder showing before the move. Tap an old Win Zero notification afterwards. | Pending count 0, and the showing reminder is cleared. No Win Zero reminder arrives at check-in time. The tap opens Win Zero's Home, which shows only the moved card. |
| 17 | **Move: Plus missing** | Uninstall Plus, then **Move** in Win Zero. | Plus's store page opens. The Move screen says Plus isn't on the phone and nothing changed. Home never asks "Did your move finish?". |
| 18 | **Move: retry** _dev_ | **Move**, then **Not now** in Plus. Back in Win Zero, wait 10 minutes (or debug clock **+1 hour**). Tap **Try again**, and this time Bring it over. Then on Android, kill Plus and reopen it from Recents. | After 10 minutes Home asks "Did your move finish?". Try again opens Plus on the same move. Afterwards Win Zero shows the moved card, and Plus's credits arrived once. Plus reopened from Recents says the move is already there, and adds nothing. |
| 19 | **Move: keep using here** | After a move, tap **Keep using Win Zero here**. Then check in, and **Move** again. | Win Zero's Home comes back with its progress from the move day, and its reminders are scheduled again (pending count above 0). Days since the move count as missed, and their news shows once. The second move asks which copy of the goal to keep, suggesting Win Zero's. |
| 20 | **Move: Plus full** | Plus with 3 goals (Add goal comes with M9; until then the screen tests cover it). **Move** from Win Zero. | Plus says "Make room first". **Manage goals** opens Settings, and nothing was added. |
| 21 | **Move: Android cold and warm** | Move with Plus killed, then again with Plus in the background. | Plus opens on the move both times, in its own task. Back from Plus returns to the launcher, not into Win Zero. |
| 22 | **Themes (Plus)** _dev_ | In the Plus dev client (`npm run start:plus`), open a practice round in each theme: `xcrun simctl openurl booted "winzeroplus://play?practice=60&theme=neon"`, or `adb shell am start -a android.intent.action.VIEW -d "winzeroplus://play?practice=60&theme=neon" com.e7systems.winzeroplus`, for `classic`, `neon`, `mono`, `pastel`, `ember`, `aurora` and `gold`. Fire every weapon, drop a bomb, and finish the round. Then `practice=1000&theme=pastel`. Then `winzero://play?practice=60&theme=neon` in Win Zero. | The zeros, shots, laser, bolts, shockwaves, particles and the fill take the theme's colors, and every zero stays easy to see. The backdrop, HUD, ×V badges and result sheet keep the usual colors. About 60 FPS at 1,000 zeros, as in row 6. Win Zero plays in Classic. |
| 23 | **Game modes (Plus)** _dev_ | In the Plus dev client, open each mode on a small phone and on a tablet (or an iPad simulator): `winzeroplus://play?practice=7&mode=catch`, then `practice=60` and `practice=1000`, for `catch`, `orbit`, `slice` and `breaker`. In each, switch power-ups mid-round, drop a bomb, and play to the end. Then `winzero://play?practice=60&mode=catch` in Win Zero. | Each mode shows its own hint and power-up names. **Catch:** the cups follow the finger from anywhere on the board and stay clear of the HUD's buttons; a zero that lands beside them floats back up, and tough zeros hop in the cup until they pop; with the finger lifted, the zeros still end up in a cup. **Orbit:** the turret sits in the middle and fires all round, the zeros circle it without touching it or leaving the board, and an armored zero splits into two smaller ones whose ×badges add up to its own. **Slice:** zeros are tossed up a few at a time; a swipe cuts them, a tough zero hops higher with each cut, a zero that falls back is tossed again, and the blade's trail follows the finger. **Breaker:** the zeros stand as bricks, steel on top; the paddle follows the finger, a dropped ball comes back to the paddle and serves itself at a brick, and with the finger lifted the round still ends (slowly, with one ball). Every round ends with the usual celebration, fill and result sheet. Win Zero plays the Shooter. |
| 24 | **Game modes with Reduce Motion** _dev_ | Turn on OS Reduce Motion, then play each mode at `practice=60` (row 23's links). | Less shake and fewer particles, as in row 7. Nothing in a mode needs motion to read: the Black Hole's rings hold still. |
| 25 | **Finish round in each mode** _dev_ | With VoiceOver, then TalkBack, open each mode at `practice=60` and `practice=1000` and use **Finish round**. | The board clears, the finale plays, "Round cleared." is announced, and the result sheet comes up. |
| 26 | **Game modes at 60 FPS** | `eas build --profile perf-plus --platform android`, then each mode at `winzeroplus://play?practice=60&mode=<id>&theme=gold` and `practice=1000`, for `catch`, `orbit`, `slice` and `breaker`. | About 60 FPS on the frame meter, with the worst frame under about 25 ms, as in row 6, in every mode with Gold Year, the brightest palette. |

### Known and accepted
- **A move can't prove it came from Win Zero on Android.** Any app can open Plus's import link
  with made-up data. Plus reads it as untrusted, shows exactly what would arrive, and asks first.
  On iPhone the data has to come from the shared folder.
- **Android reminders are inexact,** and can arrive a few minutes late. There's no exact-alarm
  permission; Play restricts it. The support page says so.
- **The support line is US-only** (SAMHSA). Localize it later.
