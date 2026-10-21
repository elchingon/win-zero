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
  - Android regenerates `android/` from clean when it was last generated for the other app
    (`scripts/prebuild.mjs`). `npm run android` (`expo run`) doesn't check: after building the
    other app, run `npx expo prebuild --platform android --clean` first.
  - iOS: `npm run open:ios` for Win Zero, `npm run open:ios:plus` for Plus. Each app keeps its own
    Xcode project, so a switch keeps its signing, build number and Pods:
    - Both build in `ios/`, which holds one app at a time. `pod install` writes absolute paths into
      the folder, so a project only builds where it was installed.
    - A switch moves the other app's project, untouched, to `.ios-parked/free/` or `.ios-parked/plus/`,
      and brings this app's back (with a `pod install`). Close the other app's workspace in Xcode
      first. Never open or build a parked project.
    - Plus's project sets `EXPO_PUBLIC_APP_VARIANT=plus` in `ios/.xcode.env`
      (`plugins/xcode-variant.js`). A build started in Xcode doesn't have your shell's environment,
      and without the pin it bundled Win Zero's JavaScript into Plus.
    - The team comes from `ios.appleTeamId` in `app.json`, so signing is set after every prebuild.
    - The version comes from `app.json` (Win Zero) or `PLUS.version` in `app.config.ts` (Plus), and
      Xcode's General tab shows it; a version typed there is replaced on the next prebuild. Set the
      **build number** in the General tab: it carries over. EAS builds keep their own (remote) build
      numbers.
    - `npm run ios` (`expo run:ios`) builds whatever `ios/` holds: run `node scripts/prebuild.mjs
      ios` (or with `EXPO_PUBLIC_APP_VARIANT=plus`) first. Never `npx expo prebuild --clean` for iOS:
      it throws away the project in `ios/` with its build number.
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
- [ ] **App icons (SPEC 9):** Plus has its own icon and one per theme (`PLUS_ICONS` in
  `app.config.ts`, art in `assets/brand-plus/icons/`). The local module `modules/app-icons` switches
  between them, not a library. `expo-alternate-app-icons` 8.0.0 and `@howincodes/expo-dynamic-app-icon`
  3.0.2 both turn off `MainActivity` while an alternate icon shows. On a Pixel, 8.0.0 then broke
  `winzeroplus://` links, the dev client, and Win Zero's move, which is an intent to
  `com.e7systems.winzeroplus.MainActivity` by name. The module keeps `MainActivity` on and moves
  only its launcher entry to one alias per icon (`.AppIcon_<id>`). Known and accepted:
  - **iPhone** always shows "You have changed the icon for 'Win Zero Plus'" (public API only).
  - **Android** closes the app on a switch if it was opened from the icon being replaced. The
    process lives on, and the app opens again from the new icon. Pixel Launcher keeps a pinned
    icon and swaps it in place.
  - **Never rename or remove a shipped icon id.** A phone showing it would be left without a
    launcher entry (and notification taps look one up).
  - **The native module links into Win Zero too,** unused. Only Plus's config sets it up, and its
    startup check runs only where `app_icons_enabled` is set (Plus).

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
- **Goals and check-in days (Plus):** Settings › Goals › **Add a goal**, up to 3, each with its own
  days. With two or more, each goal opens its own screen from Settings, with **Archive this goal**;
  archived goals wait under **Past goals**, the one place to **Delete for good**. The screens are
  also links: `winzeroplus://add-goal`, `winzeroplus://past-goals` (QA rows 35–38). In Win Zero
  they lead Home.
- **Test data on a phone that matters:** the debug clock settles *every* goal's days and can't go
  back, and **Jump to day** rewrites a goal and raises the shared best for good (archiving or
  deleting the goal keeps it). With several goals, Jump to day picks which goal to rebuild. Use a
  test install for both, or a test goal for Jump to day.
- **Themes:** Settings › Themes picks one; earned themes open at their best streak. To see any
  theme early, a Plus dev client plays a practice round in it, earned or not:
  `winzeroplus://play?practice=60&theme=<id>`, where the id is `classic`, `neon`, `mono`, `pastel`,
  `ember`, `aurora` or `gold` (QA rows 22 and 40). Win Zero ignores `&theme`.
- **Game modes:** Settings › Games picks one. A Plus dev client also plays a practice round in any
  mode, `winzeroplus://play?practice=60&mode=<id>`, where the id is `catch`, `orbit`, `slice` or
  `breaker`, and `&theme=` works alongside (QA rows 23–26 and 39). A `perf-plus` build does the same
  in release mode. Win Zero ignores `&mode`.
- **App icons:** Settings › App icon switches to any icon that's open. A Plus dev client's debug
  section in Settings also has **App icon** chips that switch to locked ones, for testing (QA rows
  27–33 and 41). Icons are native: after a change to the art or `PLUS_ICONS`, build the dev client
  again (`EXPO_PUBLIC_APP_VARIANT=plus node scripts/prebuild.mjs android`, then `npx expo
  run:android` with the variant set); a JS reload won't show them.

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
| 20 | **Move: Plus full** | In Plus, Settings → Goals → **Add a goal** until there are 3. **Move** from Win Zero. | Plus says "Make room first". **Manage goals** opens Settings, which lists the 3 goals, each opening its own screen with **Archive this goal**; nothing was added. |
| 21 | **Move: Android cold and warm** | Move with Plus killed, then again with Plus in the background. | Plus opens on the move both times, in its own task. Back from Plus returns to the launcher, not into Win Zero. |
| 22 | **Themes (Plus)** _dev_ | In the Plus dev client (`npm run start:plus`), open a practice round in each theme: `xcrun simctl openurl booted "winzeroplus://play?practice=60&theme=neon"`, or `adb shell am start -a android.intent.action.VIEW -d "'winzeroplus://play?practice=60&theme=neon'" com.e7systems.winzeroplus` (the inner quotes keep the phone's shell from cutting the link at `&`), for `classic`, `neon`, `mono`, `pastel`, `ember`, `aurora` and `gold`. Fire every weapon, drop a bomb, and finish the round. Then `practice=1000&theme=pastel`. Then `winzero://play?practice=60&theme=neon` in Win Zero. | The zeros, shots, laser, bolts, shockwaves, particles and the fill take the theme's colors, and every zero stays easy to see. The backdrop, HUD, ×V badges and result sheet keep the usual colors. About 60 FPS at 1,000 zeros, as in row 6. Win Zero plays in Classic. |
| 23 | **Game modes (Plus)** _dev_ | In the Plus dev client, open each mode on a small phone and on a tablet (or an iPad simulator): `winzeroplus://play?practice=7&mode=catch`, then `practice=60` and `practice=1000`, for `catch`, `orbit`, `slice` and `breaker`. In each, switch power-ups mid-round, drop a bomb, and play to the end. Then `winzero://play?practice=60&mode=catch` in Win Zero. | Each mode shows its own hint and power-up names. **Catch:** the cups follow the finger from anywhere on the board and stay clear of the HUD's buttons; every zero that lands, beside the cups or in one, bounces back up high; a catch off a cup's middle flies off toward that side; tough zeros bounce until they pop; with the Cup, Twin Cups, Net and Chain Catch nothing is drawn toward the cups, even with the finger lifted or the last zero left. **Orbit:** the turret sits in the middle and fires all round, the zeros circle it without touching it or leaving the board, and an armored zero splits into two smaller ones whose ×badges add up to its own. **Slice:** zeros are tossed up a few at a time; a swipe cuts them, a tough zero hops higher with each cut, a zero that falls back is tossed again, and the blade's trail follows the finger. **Breaker:** the zeros stand as bricks, steel on top; the paddle follows the finger, a dropped ball comes back to the paddle and serves itself at a brick, and with the finger lifted the round still ends (slowly, with one ball). Every round ends with the usual celebration, fill and result sheet. Win Zero plays the Shooter. |
| 24 | **Game modes with Reduce Motion** _dev_ | Turn on OS Reduce Motion, then play each mode at `practice=60` (row 23's links). | Less shake and fewer particles, as in row 7. Nothing in a mode needs motion to read: the Black Hole's rings hold still. |
| 25 | **Finish round in each mode** _dev_ | With VoiceOver, then TalkBack, open each mode at `practice=60` and `practice=1000` and use **Finish round**. | The board clears, the finale plays, "Round cleared." is announced, and the result sheet comes up. |
| 26 | **Game modes at 60 FPS** | `eas build --profile perf-plus --platform android`, then each mode at `winzeroplus://play?practice=60&mode=<id>&theme=gold` and `practice=1000`, for `catch`, `orbit`, `slice` and `breaker`. | About 60 FPS on the frame meter, with the worst frame under about 25 ms, as in row 6, in every mode with Gold Year, the brightest palette. |
| 27 | **App icons: switching (Plus)** _dev_ | In the Plus dev client, Settings → debug section → **App icon**: tap each chip, then **Win Zero Plus**. Do it once after opening Plus from its home-screen icon, and once after opening it from a link (row 28's). On iPhone, then look at the home screen. | The home-screen icon becomes that theme's, and the drawer (Android) shows one Win Zero Plus entry. Android: opened from the icon, the app closes and opens again from the new icon; opened from a link, it stays open. A pinned icon swaps in place. iPhone: "You have changed the icon for 'Win Zero Plus'" with the new icon, and the app stays open. **Win Zero Plus** puts back the Gold Edition icon. |
| 28 | **Links after an icon switch** _dev_ | With a theme's icon on (row 27), open `winzeroplus://play?practice=60&mode=catch` with Plus running and then killed: `adb shell am start -a android.intent.action.VIEW -d "'winzeroplus://play?practice=60&mode=catch'"`, with and without `com.e7systems.winzeroplus` at the end, or `xcrun simctl openurl booted …`. Then the dev client's own link, `winzeroplus://expo-development-client/?url=<server>`. | The practice round opens each time (killed, a dev client asks for its server first, then opens it). The dev client link loads Plus. Nothing says "unable to resolve". |
| 29 | **Notifications after an icon switch** _dev_ | Settings → **Send test check-in**, then switch icons (row 27) before it arrives (10 s), and tap it. Again, tapping **Yes, I did**. Then let one arrive, switch icons, and tap it. | Each tap opens Plus. Yes reaches the app (for a window that isn't open yet, Home says "That check-in isn't open yet."). |
| 30 | **The move after an icon switch** _dev_ | Plus on Ember's icon (row 27). Then row 15 from Win Zero. | As row 15: Plus opens on the preview. Win Zero never says Plus isn't on the phone. |
| 31 | **Android themed icons (Plus)** | Wallpaper & style → Themed icons on. Each icon through row 27's chips. | Every Plus icon shows as the 0 + mark in the wallpaper's colors, like the main icon. |
| 32 | **iPhone dark and tinted (Plus)** | Home Screen → Customize → Dark, then Tinted, with each icon from row 27. | Dark: the theme's mark on the dark tile. Tinted: the mark in the tint. None falls back to its light version. |
| 33 | **Erase with an earned icon (Plus)** _dev_ | In **Jump to day**, type 365 and **Go**. Pick **Gold Year** (row 27), then Settings → **Erase all data**. Again with **Neon Arcade**. | After the Gold Year erase, the home-screen icon goes back to the Plus icon (iPhone says the icon changed). After the Neon erase, Neon stays: it comes with Plus. |
| 34 | **Win Zero has no alternate icons** | In Win Zero's dev client, open Settings' debug section. `adb shell dumpsys package com.e7systems.winzero \| grep AppIcon_`. On iOS, `plutil -p <Win Zero.app>/Info.plist \| grep CFBundleAlternateIcons`. | No App icon chips. Both commands print nothing. The launcher shows one Win Zero icon, the same as before. |
| 35 | **Home with several goals (Plus)** _dev_ | With one goal, look at Home. Add a second goal whose check-in time has just passed, and a third whose check-in is later today. Answer Yes on one and leave its round unplayed. Then use **Your goals** to switch goals, with VoiceOver or TalkBack on for a pass. | With one goal, Home is Win Zero's, with no goal picker. With several: the ready round first ("Your Day N round is ready", with the goal's name over it), then the open check-ins, the one that opened first first, then **Up next** with the later goal's check-in time (**You're all caught up.** when nothing is open). Credits and the arsenal are shared. **Your goals** switches the numbers and history calendar; each goal is read out as a radio button. A paused goal gets its own "Reminders for … are paused" line. |
| 36 | **Adding goals (Plus)** _dev_ | Settings → **Add a goal**. Try **Add goal** with no wording, then add one on every day, then one on Mon, Wed and Fri. Try to untick the last day left. Then open `winzeroplus://add-goal`. | **Add goal** waits for wording. Every day is the default, and the picker says the days in words ("Mon, Wed, Fri"), in the order this phone's week starts; the last day can't be turned off ("At least one day stays on"). With 3 goals, Settings' row says "All 3 goals are in use. Archive one to add another." and the link says so too, kindly, with nothing to fill in. Setup's first goal also takes days. |
| 37 | **Archive, Past goals, Delete for good (Plus)** _dev_ | With 2 goals, Settings → a goal → **Archive this goal** → **Keep it**, then again → **Archive goal**. Settings → **Past goals** → the goal → **Delete for good** → **Keep it**, then again → **Delete for good**. | Nothing changes without the second tap. Archived, the goal's reminders stop (the debug section's **Pending** count drops), Settings shows the remaining goal's own fields again, and **Past goals** lists it read-only, its calendar ending the day it was archived. Deleted, it's gone from this phone, and its weapons and themes stay unlocked. With one goal there's no **Archive**. |
| 38 | **Check-in days (Plus)** _dev_ | On a test install (see "Test data on a phone that matters"): a goal on Mon, Wed and Fri. Use the debug clock to Friday's check-in, don't answer, then move to Saturday morning after the reminder time. Later, let 8 check-ins pass unanswered (**+7 days** twice). Also change a running goal's days in Settings, before and after that day's check-in opens. | Rest days show as a muted dash on the calendar, read out "Rest day", with no check-in card. Saturday's reminder asks about "yesterday", and the card stays open until Saturday midnight. After the missed check-ins, the notice says "The first 7 missed check-ins in a row are free". How it works speaks of check-in days. A change of days says when it starts ("These days start tomorrow"): today if today's check-in hasn't opened yet, otherwise the next day. |
| 39 | **Settings › Games (Plus)** _dev_ | Pick each mode in Settings, then start a round from Home and a bonus round. | Each row shows the mode's hint and its power-up now ("Catcher: Net"). The game picker before each round (row 52) starts on the mode picked, and a pick there shows up here. Home's arsenal, the Weapon credit question and the result sheet use the round's names. The section ends with the hint at Home's secret (row 53). |
| 40 | **Settings › Themes (Plus)** _dev_ | Pick each open theme, then look at Home and play a round. With a best streak under 30, try Ember. | Home's drifting zeros and the round take the theme; the rest of the app keeps its colors. Ember, Aurora and Gold Year show "Opens at a best streak of 30 / 180 / 365", dimmed, and can't be picked; there's no price and nothing to buy. |
| 41 | **Settings › App icon (Plus)** _dev_ | Pick an open theme's icon on each platform. On Android, open Plus from its home-screen icon first, then choose **Not now** once and **Switch icon** once. | iPhone switches at once and says "You have changed the icon for 'Win Zero Plus'". Android first asks "Switch to the … icon?", saying Plus may close; **Not now** changes nothing; **Switch icon** switches, and opened from the icon, Plus closes (open it again from the new one). Locked icons show "Opens at N" and can't be picked. Each tile is read out as "… icon". |
| 42 | **The result sheet's theme line (Plus)** _dev_ | On a test install, or a test goal (see "Test data on a phone that matters"): **Jump to day** 30, play the round. Again with 365. | After the fill, the sheet says "New theme unlocked: Ember. Its app icon is unlocked too." (Gold Year at 365) under the weapon line, read in order by a screen reader. Ember is now open in Settings › Themes and App icon. |
| 43 | **Win Zero unchanged by Plus's screens** | In Win Zero, look at Home, Settings and Setup. Open `winzero://add-goal`, `winzero://goal?id=x`, `winzero://past-goals` and `winzero://past-goal?id=x`. | One goal, every day; Settings has no Goals, Check-in days, Games, Themes or App icon; Setup has no day picker. Each link leads Home, with nothing changed. |
| 44 | **Android haptics with Touch feedback off** | Settings › Sound & vibration › Vibration & haptics: turn **Touch feedback** off. Open `winzero://play?practice=60` and clear it; tap **Yes, I did** when a check-in is due. Then `adb shell dumpsys vibrator_manager`. | The kills, bombs, the final boom and the Yes buzz, listed as `usage: MEDIA … finished`. Buttons and wheel ticks stay still (`usage: TOUCH`, ignored). With Touch feedback on, they click too. With Media vibration off, nothing buzzes but the system's own. |
| 45 | **The final boom** | Clear a practice round on each platform (in Plus, in each game mode). | iPhone: two heavy taps close together. Android: a strong hit about a quarter of a second long. |
| 46 | **The Yes celebration** | Tap **Yes, I did** near each end of the button, in both apps (in Plus, on a second goal's card too). Again with Reduce Motion on, with sound off, and with VoiceOver / TalkBack (double tap). | A zero pops up out of the button with a burst of mini zeros, the chime and a small haptic. Dark floods out from it, then its hole opens onto the round, with no fade between. About 60 FPS on a mid-range Android. Reduce Motion: the chime and haptic only, and the round opens at once. Sound off: no chime. A screen reader's double tap starts it low in the middle. A notification's Yes and **Play now** open the round as before. |
| 47 | **Credit hints** | On Home, tap the "i" on Game credits and on Weapon credits: with none, with some, and with a bonus round waiting. Also with VoiceOver / TalkBack, and at the largest text size. | Each opens a popup: what the credit does, how to spend it, and every way to earn one, with the one-time ones already earned marked; the ways that start with "Every" never are. **Got it**, tapping outside or Android back closes it. Screen readers reach each hint after its count and start at the popup's title. At the largest text, the popup scrolls. |
| 48 | **Website: the Yes and the hints** | On winzero.app/play, click **Yes, I did**, and on another day press Enter on it. Turn on reduced motion in the browser. Open each credit hint. | The same celebration and chime (from the keyboard, it starts at the button's middle). Reduced motion opens the round at once. The hints open as dialogs, and Escape closes them. |
| 49 | **The Game credit popup** | In both apps, on a day whose Yes makes 3 zeros or 7 Yeses in a row: tap **Yes, I did** on Home and play the round to the end. Again with the Yes from a notification, playing the round from Home later. Then **Replay**. Also with sound off, haptics off, and VoiceOver / TalkBack. | After the cheer's **Got it**, a popup: a big **+1**, "Game credit earned!", why ("Earned for every 7 Yeses in a row."), and "You now have N Game credits", with the Yes chime and a short success buzz. **Nice!**, tapping outside or Android back closes it, and the result sheet lists the credit. After a notification's Yes, Home's count already shows it. Replay shows no popup. Sound off: no chime; haptics off: no buzz. A screen reader starts at "+1 Game credit earned!". |
| 50 | **Credits that keep coming** _dev_ | On a test phone (never the tester's own progress: the jump rewrites the goal), **Jump to day 7** and play the round. Move the debug clock on a day, **Jump to day 14** and play it; again for 30 and 60. | Day 7 and 14: the popup says "Earned for every 7 Yeses in a row." (on day 7 the first time, with the 3-zero credit too: +2). Day 30 and 60: the result sheet says "Weapon credit earned for every 30 Yeses in a row." Each credit hint lists "Every 7 Yeses in a row" and "Every 30 Yeses in a row", never marked earned. (A second jump on the same day lands on the same day's mark, so it pays no every-N credit again.) |
| 51 | **Website: the Game credit popup** | On winzero.app/play in demo mode, **Jump to day 7** and play the round to the end. Press Escape on the popup; on another run, click outside it. | The same popup after the cheer, with the chime. Nice! has focus, so Enter or Escape moves on to the result sheet. |
| 52 | **Pick your game (Plus)** | Tap **Yes, I did** on a goal's check-in. Pick Catch. Then start a bonus round, and tap outside the picker. With a Weapon credit held, start another bonus round. Then **Replay** a round, and leave a round not yet played and come back to it. Also at the largest text size and with VoiceOver / TalkBack. | "Pick your game" comes up before the round, as the Yes celebration's hole opens, with every game, its hint and power-up, and the last pick marked. Catch plays Catch, and Settings › Games now shows Catch. Tapping outside or Android back plays the last pick. The Weapon credit question comes after the pick, worded for that game. Replay doesn't ask; coming back to a round not yet played asks again. At the largest text the list scrolls. Win Zero never asks. |
| 53 | **Home's secret (Plus)** | On Home (with several goals, under the **Game** tab), tap the Game credits count three times quickly, then again. Tap it three times slowly (about a second apart). Tap the "i". Then read the end of Settings › Games. Repeat the quick taps in Win Zero. | Each quick triple tap adds a Game credit, with a "+1 Free Game credit!" popup ("You found the secret stash."), the Yes chime and its buzz; **Sweet!** closes it. Slow taps do nothing. The "i" still opens the hint. Settings › Games ends with "Psst. Somewhere on Home, a little box hands out free games…". Win Zero does nothing. |
| 54 | **Xcode Release builds of both apps** | `npm run open:ios:plus`, then a Release run on an iPhone from Xcode. Then `npm run open:ios` and a Release run of Win Zero. Set a build number in each app's General tab, switch twice, and look again. | Plus is Plus: "Pick your game" before a round, and Settings shows Goals, Games, Themes and App icon. Win Zero shows none of these, and both apps stay installed side by side. Signing needs no team picked. Each General tab shows its own version (Win Zero's from `app.json`, Plus's `PLUS.version`) and keeps the build number set there. |
| 55 | **Home's tabs, Edit and Add goal (Plus)** | With 2 goals, open Home. Tap **Game**, start a round from a check-in or a bonus round, and come back. Tap **Goals**, pick the second goal, and tap **Edit**, then **Done**. Tap **Add goal**, then **Cancel**; then add a third goal and look again. Also at the largest text size and with VoiceOver / TalkBack. Then open Home with one goal. | The check-ins and Up next stay above the tabs. **Goals** opens first, with Your goals, the picked goal, its numbers and its calendar; **Game** shows the credits and the arsenal, and coming back from a round keeps the tab. **Edit** opens the goal picked, and Done returns Home. **Add goal** opens Add a goal while there's room, and is gone with 3 goals. Screen readers read the tabs as tabs, with the one shown selected; at the largest text, a long goal name wraps with Edit on its first line. With one goal, Home is unchanged: no tabs, Edit or Add goal. |

### Known and accepted
- **A move can't prove it came from Win Zero on Android.** Any app can open Plus's import link
  with made-up data. Plus reads it as untrusted, shows exactly what would arrive, and asks first.
  On iPhone the data has to come from the shared folder.
- **Android reminders are inexact,** and can arrive a few minutes late. There's no exact-alarm
  permission; Play restricts it. The support page says so.
- **The support line is US-only** (SAMHSA). Localize it later.
