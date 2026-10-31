# Releasing Win Zero

The path from this branch to both stores, and the device QA to pass first. The store copy and form
answers are in `docs/store/`: `listing.md`, `answers.md` and `screenshots.md` for Win Zero, and the
`-plus` ones for Win Zero Plus.

## Release run sheet

Nothing is in either store yet. **Win Zero Plus 1.2.0 goes first, then Win Zero 1.2.0** once Plus is
live in both stores, because Win Zero 1.2.0 offers the move to Plus (see "Release order for the
move"). Both are built on this Mac ("Store builds on this Mac", in section 3). Row numbers are the
QA matrix's, at the end.

1. **Now, on development builds.** Plus: rows 22–25, 27–30, 33, 35–42, 52, 53, 55 and 65, and 3, 4,
   13 and 50 on a Plus test install. Win Zero: 34 and 43.
2. **By Saturday, October 31: row 1,** the US clock change on Sunday, November 1. Put release builds
   of both apps on your phones (`npm run build:android && npm run install:android`, then the
   `:plus` pair; on iPhone, a Release run from Xcode, as in row 54) and keep them there through
   Sunday evening. The next chance is March.
3. **Win Zero Plus's records and money** (Win Zero Plus, below): the App Store Connect record, the
   Paid Apps Agreement with tax and banking, the Small Business Program, the price; Play's
   payments profile and the app created as **Paid**; the App Group; Plus's upload key.
4. **Plus 1.2.0 store builds:** `.env` with the privacy and support pages and Plus's own store
   pages, `npm run check:release:ios:plus`, then archive and upload to TestFlight; `npm run
   build:android:plus:upload -- --version-code 1`, then upload to Play's internal testing track.
5. **Plus's gate rows** on those builds: 2, 5, 7–12, 14, 31, 32, 44–47, 49, 54, 56–64 and 66–68,
   and 26 on a local perf build (`EXPO_PUBLIC_PERF_BUILD=1 npm run build:android:plus`; for row 6,
   the same without `:plus`). The move's arriving side too, rows 15–21 and 30, with Win Zero's development build (its
   `.env` from `.env.example`, so it offers the move): Plus 1.2.0 has to read every move Win Zero
   1.2.0 will send.
6. **The website:** merge to `main`, so winzero.app's `/support` and `/privacy` describe Plus before
   App Review reads them. Then row 48 and 51 on the live site.
7. **Submit Plus:** listing, screenshots and forms from the `-plus` docs; App Review notes from
   `answers-plus.md`. Choose **Manually release this version** on iOS. For Play, verify managed
   publishing is available before relying on a held launch: it cannot control an app's first-ever
   publication; Google recommends publishing to closed testing first. If it isn't available, allow
   for the first release to publish after approval. Release iOS once Play is ready, and check both
   store pages before submitting Win Zero's Move build. See
   [Google's publishing controls](https://support.google.com/googleplay/android-developer/answer/9859654).
8. **Win Zero 1.2.0 store builds:** version 1.2.0 in `app.json` (and `package.json`); `.env` with
   Plus's live store pages; `npm run check:release:ios` (it should say Win Zero offers the move),
   then archive and upload; `npm run build:android:upload -- --version-code 1`.
9. **Win Zero's gate rows:** 1–14 (row 1 if it wasn't run on Win Zero), 15–21 again with both store
   builds (row 17 now opens Plus's live page), 34, 43, 44–47, 49, 56–64, Win Zero's half of 65, 66
   and 67.
10. **Submit Win Zero 1.2.0,** with the App Review notes from `answers.md` (Plus's Apple ID filled
    in), and release.
11. **The website's store links:** `website/partials/stores.html` (see "When the apps are live").
12. **The first week:** App Store Connect crashes and Play vitals, for both apps.

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
  - Fields: iOS, name **Win Zero Goal Tracker Game**, bundle ID `com.e7systems.winzero`, any SKU, and a primary
    language.
  - Copy the app's **Apple ID** (a number) into `eas.json` under
    `submit.production.ios.ascAppId`.
- [ ] **Play Console → Create app.** Sign in at
  [play.google.com/console](https://play.google.com/console) with the organization developer
  account, open **Home** and select **Create app**. The form:
  - **App name:** `Win Zero Goal Tracker Game`. Google Play shows it, and it can change later.
  - **Default language:** English (United States) – en-US.
  - **App or game:** App.
  - **Free or paid:** Free. Play never lets a free app become paid, so this choice is final. Plus is
    created as Paid (Win Zero Plus, below).
  - **Contact email:** `e7urgent@gmail.com`, as in `listing.md`. Google Play users see it.
  - **Declarations:** tick **Developer Program Policies** and **US export laws**, and accept the
    **Play App Signing Terms of Service**.
  - Select **Create app**. It doesn't ask for the package name: the first AAB uploaded sets it to
    `com.e7systems.winzero`, and it can't change after that. The app's **Dashboard** then lists the
    setup tasks, and section 4 has the answers.
- [ ] **Play service account:** only needed for `eas submit` ("Play service account", below).
  Skip it while you build on this Mac and upload in Play Console, as the release run sheet does.

### Play service account

`eas submit` uploads Android builds to Play through Google's API. It signs in as a Google Cloud
*service account*: a robot user with its own email, and a JSON key file instead of a password.
Builds you upload in Play Console yourself don't need one. One account and one key cover both apps.

1. **Make the account in Google Cloud.** Sign in at
   [console.cloud.google.com](https://console.cloud.google.com) with the Google account you use for
   Play Console.
   1. In the project picker (top bar), choose **New project**, name it `win-zero-play` for example,
      select **Create**, then select the new project in the picker.
   2. Under **APIs & Services → Library**, search for **Google Play Android Developer API** and
      select **Enable**. Without it, uploads fail even when the permissions are right.
   3. Under **IAM & Admin → Service accounts**, select **Create service account**. Name it
      `eas-submit` and finish (**Create and close**, or **Done**) without adding Cloud roles:
      Play Console grants its access in step 3.
   4. Copy the account's email from the list. It looks like
      `eas-submit@win-zero-play.iam.gserviceaccount.com`.
2. **Make its key.** Open the account, then **Keys → Add key → Create new key → JSON →
   Create**. A `.json` file downloads.
   - Move it out of Downloads into a folder outside the repo, such as `~/Secrets/`. Anyone with
     the file can release your apps. Never commit it: `.gitignore` only catches names containing
     `service-account`.
   - If Google says "Service account key creation is disabled", the Cloud organization enforces
     the policy `iam.disableServiceAccountKeyCreation`. Someone with the Organization Policy
     Administrator role turns it off for this project (**IAM & Admin → Organization policies**).
     Then try again.
3. **Let it into Play Console.** In Play Console's left menu (outside any app), open **Users and
   permissions**, then **Invite new users**:
   - **Email address:** the service account's email.
   - On the **App permissions** tab, select **Add app**, tick **Win Zero** and **Win Zero Plus**,
     then **Apply**. The run sheet creates Plus's record first, so both exist by now. An app made
     later is added the same way, from the account's row in Users and permissions.
   - Tick these permissions and leave the rest off (no Admin, financial data, orders or review
     replies). Play ticks a few related ones itself; leave those on.
     - View app information (read-only)
     - Edit and delete draft apps
     - Release to production, exclude devices, and use Play App Signing
     - Release apps to testing tracks
     - Manage testing tracks and edit tester lists
     - Manage store presence
   - Select **Apply**, then **Invite user**. A service account doesn't confirm by email, but Play
     can take some hours, up to a day, to let it in.
4. **Give the key to EAS,** once for each app. Run this from the repo root, signed in to Expo
   (`eas whoami` shows the account; `eas login` if it doesn't):

   ```
   eas credentials --platform android
   ```

   Then answer the prompts:
   1. **Which build profile do you want to configure?** Choose `production` for Win Zero, or
      `production-plus` for Plus. The profile decides which app you're setting up. EAS then prints
      that app's credentials, headed by **Application Identifier**. Carry on only if it reads
      `com.e7systems.winzero` (or `com.e7systems.winzeroplus`).
   2. **What do you want to do?** Choose **Google Service Account**.
   3. **What do you want to do?** Choose **Manage your Google Service Account Key for Play Store
      Submissions**.
   4. **What do you want to do?** Choose **Set up a Google Service Account Key for Play Store
      Submissions**.
   5. The first app asks **Path to Google Service Account file:**. Delete the sample name it
      fills in, and type the key's full path, such as `/Users/<you>/Secrets/win-zero-play-1a2b.json`
      (`~` doesn't work here). EAS checks the file and stores it in the Expo account.
      The second app asks **Select the Google Service Account Key to use for your project:**.
      Choose **[Choose an existing key]**, then the same key.
   6. The key now shows under **Submissions: Google Service Account Key for Play Store
      Submissions**. Choose **Exit**.

   Nothing goes into `eas.json` or the repo: `eas submit` looks the key up by the app. Keep the
   downloaded file as a backup, or delete it: step 2 can make a new key at any time.
5. **If the first `eas submit` fails:**
   - "The caller does not have permission": Play hasn't let the account in yet. Wait a few hours
     after step 3 and try again.
   - "Only releases with status draft may be created on draft app": the app has never had a
     release. Make the first one by hand in Play Console ("Store builds on this Mac", in section 3).
     Or add `"releaseStatus": "draft"` to the submit profile's `android` in `eas.json`, and finish
     the release in Play Console.

## 3. Build and test

- [ ] `eas build --profile production --platform all`. Build numbers increment remotely.
- [ ] **Android:** `eas submit --profile production --platform android` sends the build to the
  **internal testing** track. Add testers in Play Console → Testing → Internal testing.
- [ ] **iOS:** `eas submit --profile production --platform ios` sends it to **TestFlight**. Add
  internal testers.
- [ ] Run the QA matrix below on TestFlight and internal-track builds. A `preview` build works
  too.

### Store builds on this Mac
The EAS steps above are one way. The other, used for the first releases, builds both apps here.

- **Check what the build will carry.** A local release bundles the `EXPO_PUBLIC_*` values Expo reads
  from `.env`, not `eas.json`, and only EAS builds run `check-release.mjs` on their own. So:
  - `npm run check:release:ios` (Win Zero) or `check:release:ios:plus` before an archive. It stops
    unless the privacy and support pages are https, and unless any Plus store page is Plus's real
    one (the `preview` profile's stand-in `https://winzero.app/` isn't). It also says whether Win Zero
    will offer Plus and the move.
  - `npm run open:ios[:plus]` prints the same, as a warning.
  - `build:android[:plus]:upload` runs it first and stops on a problem; a test build only warns.
- **iOS:** `npm run open:ios` (or `open:ios:plus`). In Xcode, set the **build number** in the
  General tab (each upload of a version needs a new one), pick **Any iOS Device**, then **Product
  → Archive**, and in the Organizer **Distribute App → App Store Connect → Upload**. It reaches
  TestFlight after processing.
- **Android:** `npm run build:android:upload -- --version-code <N>` (or `build:android:plus:upload`).
  Play takes an upload only if its version code is above every earlier one for that app (Play
  Console → Test and release → App bundle explorer), so start at 1 and count up. The script
  prints the version and code it built, and the key that signed it. Upload `build/win-zero.aab`
  (or `win-zero-plus.aab`) in Play Console → Test and release → Testing → Internal testing →
  Create new release. The first upload enrolls the app in Play App Signing, with the key that
  signed it as the upload key.
- **R8:** Android release builds, local and EAS, shrink and obfuscate their code with R8
  (`expo-build-properties` in `app.json`), which Play's DEX optimization check asks for. The AAB
  carries R8's mapping file and the native debug symbols, so Play reads crashes and ANRs without a
  separate upload. R8 can strip code that native modules only reach by reflection, so play a round
  on a release build before uploading: a missing class crashes at once.

## 4. Listings and forms

- [ ] **Store review gates:** work through [the October 24 review](store/review.md), especially
  pending iOS transfer deletion, the live pages still missing Plus, final screenshot exports,
  questionnaire updates and the separate-app review risk. The source drafts alone do not clear
  those gates.

- [ ] **Listing copy:** paste from `docs/store/listing.md`, with the URLs filled in.
- [ ] **Audience tags:** use [the tag plan](store/tags.md) for both apps. Confirm actual Play
  labels, review Apple's generated tags, and save the final selections with this release.
- [ ] **Graphics:**
  - Icon: `assets/brand/google-play-icon.png`
  - Feature graphic: `assets/brand/play-feature-graphic.png`
  - Screenshots: from `docs/store/screenshots.md`
- [ ] **Forms:** App Privacy, Data safety, Health apps, content rating, target audience, ads and
  app access, all from `docs/store/answers.md`.
- [ ] **Accessibility claims:** the descriptions name VoiceOver/TalkBack, larger text and reduced
  motion. Keep those lines only if they pass the QA below (rows 7–9, 24 and 56–64, and 66).

## 5. Release

- [ ] **iOS:** submit for review, with the App Review notes from `answers.md`.
- [ ] **Android:** complete production-access requirements, then promote the tested build to
  production. Percentage-based staged rollouts are for updates; do not plan a 20% first launch.
  See [Google's release instructions](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en).
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
- [ ] **Store records:** create both early. A record holds the name, and "Win Zero Plus" could be
  taken by someone else meanwhile.
  - App Store Connect → New App: **Win Zero Plus**, bundle ID `com.e7systems.winzeroplus`. Copy its
    Apple ID into `eas.json` under `submit.production-plus.ios.ascAppId` (for EAS submit), and into
    the Win Zero review notes in `answers.md`.
  - Play Console → Create app: the same form as Win Zero's (section 2), with the name **Win Zero
    Plus** and **Paid**. Google Play never lets an app that has been free become paid, so choose
    Paid now, and never publish it as free on any track. Its first AAB sets the package name to
    `com.e7systems.winzeroplus`.
- [ ] **Getting paid (Apple):** App Store Connect → Business: the **Paid Apps Agreement** must be
  Active, with tax forms and a bank account, before a paid app can be sold. The Account Holder
  signs it. Then enroll in the **App Store Small Business Program**, which takes 15% rather than
  30% under $1M a year. It isn't automatic.
- [ ] **Getting paid (Google):** Play Console → Setup → **Payments profile**, linked to the developer
  account; a price can't be set without it. Enroll in Google's **15% service fee tier** and
  complete its Account Group requirements; the reduced tier is not automatic. See
  [Google's enrollment guidance](https://support.google.com/googleplay/android-developer/answer/10632485?hl=en).
- [ ] **Price:** **$4.99** (USD) in both stores: App Store Connect → Pricing and Availability (the
  United States as the base country), and Play Console → Monetize → App pricing. Let each store set
  the other countries'. The same countries as Win Zero.
- [ ] **Testing a paid app on Play:** the **internal testing** track installs it free for its
  testers. Closed and open tracks make testers buy it. If the developer account is a personal one
  made after November 13, 2023, Play asks for a closed test with at least 12 testers for 14 days
  before production; give those testers **promo codes** (Monetize → Promo codes) rather than asking
  them to pay. Check Play's current rules first: they change.
- [ ] **Listing and forms:** `docs/store/listing-plus.md` (copy, $4.99, graphics from
  `assets/brand-plus/`), `answers-plus.md` (App Privacy, Data safety, ratings, and the App Review
  notes), `screenshots-plus.md`.
- [ ] **If App Review rejects Plus under 4.3(a)** (several apps that are the same app): reply in the
  Resolution Center with what Plus does that Win Zero doesn't (`answers-plus.md` has it), and point
  to the different name, icon, screenshots and price. If Apple holds to it, the fallback is to sell
  Plus's features inside Win Zero as an unlock, which is a large change: in-app purchases, a
  Restore flow, and new store answers.
- [ ] **Home-screen name (plan decision 14):** "Win Zero Plus" fits under the icon in full on the
  smallest iPhones iOS 26 runs on, the iPhone SE (3rd generation) and the 13 mini, even at the
  largest text size, where iOS tightens the letters (simulators, iOS 26.5, October 21, 2026). So it
  stays "Win Zero Plus" everywhere. Row 68 checks Android launchers.
- [ ] **Builds:** `eas build --profile production-plus --platform all --auto-submit-with-profile
  production-plus`, or `eas submit --profile production-plus --id <build id>`. Never `--latest`:
  it can pick the other app's build.
- [ ] **Local builds:**
  - Android: `npm run build:android:plus`, or `build:android:plus:upload -- --version-code <N>`
    with Plus's own upload key in `.env.signing.plus` (gitignored). Install with `npm run
    install:android:plus`.
  - **Plus's upload key:** make one for Plus alone, not Win Zero's, so each app's Play App Signing
    has its own: `keytool -genkeypair -v -storetype JKS -keyalg RSA -keysize 2048 -validity 10000
    -keystore <somewhere outside the repo>/win-zero-plus-upload.jks -alias win-zero-plus-upload`.
    Then `.env.signing.plus` takes the same four `ANDROID_UPLOAD_*` names as `.env.signing`. Back up
    the keystore and its passwords; Play can reset an upload key, but slowly.
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
  free app hides Home's Plus button and Settings → **Win Zero Plus**. If Plus isn't installed, the
  move opens the page. Plus opens its own page for "Update Win Zero Plus".
  - The `preview` profile (and `preview-plus`) sets the Play page and a stand-in iOS page
    (`https://winzero.app/`) for QA. Local runs take them from `.env` (see `.env.example`).
  - For release, set both: `https://apps.apple.com/app/id<Plus's Apple ID>` and
    `https://play.google.com/store/apps/details?id=com.e7systems.winzeroplus`. EAS builds take them
    from the `production` profile's env (`production-plus` inherits them); local builds from
    `.env`. `npm run check:release:ios[:plus]` and `build:android[:plus]:upload` refuse the
    stand-in, and say whether Win Zero will offer the move.
  - Plus 1.2.0 can carry them from its first build (for its own "Update Win Zero Plus" button). Win
    Zero carries them from 1.2.0, which waits for Plus to be live.
- [ ] **Release order for the move:** release **Plus 1.2.0 first** and wait until it's live in both
  stores. Then release **Win Zero 1.2.0**, with the Plus store URLs set. A Win Zero build with the
  URLs set before Plus is live would offer a move to an app nobody can install.
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
  - Win Zero: Settings → Win Zero Plus → **Move to Win Zero Plus** → **Move**.
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
- [ ] **When each listing is live:** in `website/plugins/marketing.ts`, set that store link's
  `live: true` in `APPS` (Win Zero and Win Zero Plus, App Store and Google Play, one at a time
  as each opens). Until then the site says "coming soon" there. Check the link opens the listing,
  then push: the store buttons on `/` and `/plus`, the structured data, `/llms.txt` and Safari's
  Smart App Banner pick it up.
- [ ] **New store screenshots:** after `npm run gen:store-shots`, run `npm run gen:shots` in
  `website/` and commit `website/src/site/shots/`.
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
| 7 | **Reduce motion, silent switch, haptics off** | Turn on OS Reduce Motion. Flip the iPhone silent switch. Turn haptics off in Settings. Play a round each time. | Less shake, fewer particles, and a bomb's and the last zero's flash only a faint wash. No sound when silenced. No buzz with haptics off. |
| 8 | **VoiceOver / TalkBack** | Home: swipe through, and use heading navigation. Calendar: change months. Arsenal, the check-in card, and a round. | Headings: Daily goal, Arsenal, History. The calendar reads a month summary and "today". Buttons say what they'd do. **Finish round** clears a round (also the VoiceOver two-finger double-tap). "Round cleared" is announced, then focus lands on "N zeros down". |
| 9 | **Largest text size** | iOS: Accessibility → Larger Text at maximum. Android: font size and display size at maximum. | Home and Settings stay readable, and the check-in and result buttons stack. The result sheet scrolls rather than running off the screen. The HUD stays in its bands. |
| 10 | **Icons and splash** | Home screen in light and dark (and tinted on iOS 18). Android themed icons on. A reminder in the status bar. Cold launch. | The brand zero shows everywhere, and the Android themed icon follows the wallpaper color. The status-bar icon is a full-size white zero. The launch splash plays, then Home. |
| 11 | **Release permissions** | `bundletool dump manifest --bundle app.aab` (or `aapt dump permissions` on a preview APK). | No storage or SYSTEM_ALERT_WINDOW permissions, and no exact-alarm permission. |
| 12 | **Fresh install and erase** | Install fresh, go through Setup and allow notifications. Then Settings → Erase all data. | The permission explanation shows before the OS prompt. After erasing, Setup shows and the pending count is 0. |
| 13 | **Answering the next evening** _dev_ | Leave a check-in unanswered. Move the debug clock to 9:00 PM the next day, then answer. Leave the next one unanswered and move the clock past the following midnight. | At 9:00 PM, Home asks about yesterday and says "Open until the end of today". That evening's notification has no buttons, and tapping it opens Home. After answering yesterday, today's card shows. Past midnight, the unanswered day is recorded as missed, and the day after it is still open. |
| 14 | **Changing the check-in time** | Leave yesterday's check-in unanswered. In Settings, set the check-in time a few minutes from now, then lock the phone. | Settings says "Next check-in: today at …" with the new time. The notification arrives then, without buttons while yesterday is open, and tapping it opens Home on yesterday's card. |
| 15 | **Move: 1,000 days** _dev_ | Win Zero: **Jump to day 1000**. Settings → Win Zero Plus → **Move to Win Zero Plus** → **Move**. In Plus, read the preview, tap **Bring it over**, and allow notifications. | Plus opens on the preview: the goal, streak 1000 and its Yes days, the credits, and the settings. Nothing changes until Bring it over. Then Win Zero opens with "Your goals now live in Win Zero Plus". Plus's Home shows the same streak, history, weapons and credits, and its reminders are scheduled. |
| 16 | **Move: Win Zero goes quiet** _dev_ | After row 15, check Win Zero's debug pending count. Leave a Win Zero reminder showing before the move. Tap an old Win Zero notification afterwards. | Pending count 0, and the showing reminder is cleared. No Win Zero reminder arrives at check-in time. The tap opens Win Zero's Home, which shows only the moved card. |
| 17 | **Move: Plus missing** | Uninstall Plus, then **Move** in Win Zero. | Plus's store page opens. The Move screen says Plus isn't on the phone and nothing changed. Home never asks "Did your move finish?". |
| 18 | **Move: retry** _dev_ | **Move**, then **Not now** in Plus. Back in Win Zero, wait 10 minutes (or debug clock **+1 hour**). Tap **Try again**, and this time Bring it over. Then on Android, kill Plus and reopen it from Recents. | After 10 minutes Home asks "Did your move finish?". Try again opens Plus on the same move. Afterwards Win Zero shows the moved card, and Plus's credits arrived once. Plus reopened from Recents says the move is already there, and adds nothing. |
| 19 | **Move: keep using here** | After a move, tap **Keep using Win Zero here**. Then check in, and **Move** again. | Win Zero's Home comes back with its progress from the move day, and its reminders are scheduled again (pending count above 0). Days since the move count as missed, and their news shows once. The second move asks which copy of the goal to keep, suggesting Win Zero's. |
| 20 | **Move: Plus full** | In Plus, Settings → Goals → **Add a goal** until there are 3. **Move** from Win Zero. | Plus says "Make room first". **Manage goals** opens Settings, which lists the 3 goals, each opening its own screen with **Archive this goal**; nothing was added. |
| 21 | **Move: Android cold and warm** | Move with Plus killed, then again with Plus in the background. | Plus opens on the move both times, in its own task. Back from Plus returns to the launcher, not into Win Zero. |
| 22 | **Themes (Plus)** _dev_ | In the Plus dev client (`npm run start:plus`), open a practice round in each theme: `xcrun simctl openurl booted "winzeroplus://play?practice=60&theme=neon"`, or `adb shell am start -a android.intent.action.VIEW -d "'winzeroplus://play?practice=60&theme=neon'" com.e7systems.winzeroplus` (the inner quotes keep the phone's shell from cutting the link at `&`), for `classic`, `neon`, `mono`, `pastel`, `ember`, `aurora` and `gold`. Fire every weapon, drop a bomb, and finish the round. Then `practice=1000&theme=pastel`. Then `winzero://play?practice=60&theme=neon` in Win Zero. | The zeros, shots, laser, bolts, shockwaves, particles and the fill take the theme's colors, and every zero stays easy to see. The backdrop, HUD, ×V badges and result sheet keep the usual colors. About 60 FPS at 1,000 zeros, as in row 6. Win Zero plays in Classic. |
| 23 | **Game modes (Plus)** _dev_ | In the Plus dev client, open each mode on a small phone and on a tablet (or an iPad simulator): `winzeroplus://play?practice=7&mode=catch`, then `practice=60` and `practice=1000`, for `catch`, `orbit`, `slice` and `breaker`. In each, switch power-ups mid-round, drop a bomb, and play to the end. Then `winzero://play?practice=60&mode=catch` in Win Zero. | Each mode shows its own hint and power-up names. **Catch:** the cups follow the finger from anywhere on the board and stay clear of the HUD's buttons; every zero that lands, beside the cups or in one, bounces back up high; a catch off a cup's middle flies off toward that side; tough zeros bounce until they pop; with the Cup, Twin Cups, Net and Chain Catch nothing is drawn toward the cups, even with the finger lifted or the last zero left. **Orbit:** the turret sits in the middle and fires all round, the zeros circle it without touching it or leaving the board, and an armored zero splits into two smaller ones whose ×badges add up to its own. **Slice:** zeros are tossed up a few at a time; a swipe cuts them, a tough zero hops higher with each cut, a zero that falls back is tossed again, and the blade's trail follows the finger. **Breaker:** the zeros stand as bricks, steel on top; the paddle follows the finger, a dropped ball comes back to the paddle and serves itself at a brick, and with the finger lifted the round still ends (slowly, with one ball). Every round ends with the usual celebration, fill and result sheet. Win Zero plays the Shooter. |
| 24 | **Game modes with Reduce Motion** _dev_ | Turn on OS Reduce Motion, then play each mode at `practice=60` (row 23's links). | Less shake, fewer particles and faint flashes, as in row 7. Nothing in a mode needs motion to read: the Black Hole's rings hold still. |
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
| 35 | **Home with several goals (Plus)** _dev_ | With one goal, look at Home. Add a second goal whose check-in time has just passed, and a third whose check-in is later today. Answer Yes on one and leave its round unplayed. Then use **Your goals** to switch goals, with VoiceOver or TalkBack on for a pass. | With one goal, Home is laid out as with several: **Your goals** with its one goal picked, **Add goal**, **Edit**, and the **Goals** and **Game** tabs. With several: the ready round first ("Your Day N round is ready", with the goal's name over it), then the open check-ins, the one that opened first first, then **Up next** with the later goal's check-in time (**You're all caught up.** when nothing is open). Credits and the arsenal are shared. **Your goals** switches the numbers and history calendar; each goal is read out as a radio button. A paused goal gets its own "Reminders for … are paused" line. |
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
| 49 | **The Game credit popup** | In both apps, on day 1 of a fresh start (Settings › Erase all data, then set up), and on a day whose Yes makes 3 zeros or 7 Yeses in a row: tap **Yes, I did** on Home and play the round to the end. On day 1, tap **Back to base** after the sheet, then reopen the app. Again with the Yes from a notification, playing the round from Home later. Then **Replay**. Also with sound off, haptics off, and VoiceOver / TalkBack. | After the cheer's **Got it**, a popup: a big **+1**, "Game credit earned!", why ("Earned for every 7 Yeses in a row."), and "You now have N Game credits", with the Yes chime and a short success buzz. **Nice!**, tapping outside or Android back closes it, and the result sheet lists the credit. After a notification's Yes, Home's count already shows it. Replay shows no popup. Sound off: no chime; haptics off: no buzz. A screen reader starts at "+1 Game credit earned!". Day 1: "Earned for your first Yes.", and back on Home a tip, "Day one, done.", with the saying, how the app works and the next check-in; **Let's go** closes it, and it doesn't come back. |
| 50 | **Credits that keep coming** _dev_ | On a test phone (never the tester's own progress: the jump rewrites the goal), **Jump to day 7** and play the round. Move the debug clock on a day, **Jump to day 14** and play it; again for 30 and 60. | Day 7 and 14: the popup says "Earned for every 7 Yeses in a row." (on day 7 the first time, with the 3-zero credit too: +2, or +3 with the first Yes's credit on a phone that hasn't answered Yes before). Day 30 and 60: the result sheet says "Weapon credit earned for every 30 Yeses in a row." Each credit hint lists "Every 7 Yeses in a row" and "Every 30 Yeses in a row", never marked earned. Day 7 and Day 30 each also open their celebration back on Home (row 69), so close it before the next jump. (A second jump on the same day lands on the same day's mark, so it pays no every-N credit again.) |
| 51 | **Website: the Game credit popup** | On winzero.app/play in demo mode, **Jump to day 7** and play the round to the end. Press Escape on the popup; on another run, click outside it. Then, after Settings › Erase all data, set up, Yes, and play day 1 to the end and go **Back to base**. | The same popup after the cheer, with the chime. Nice! has focus, so Enter or Escape moves on to the result sheet. Day 1: "Earned for your first Yes.", then Home's "Day one, done." tip, which **Let's go**, Escape or a click outside closes for good. Back on Home after the Day 7 round, the celebration opens too (row 69). |
| 52 | **Pick your game (Plus)** | Tap **Yes, I did** on a goal's check-in. Pick Catch. Then start a bonus round, and tap outside the picker. With a Weapon credit held, start another bonus round. Then **Replay** a round, and leave a round not yet played and come back to it. Also at the largest text size and with VoiceOver / TalkBack. | "Pick your game" comes up before the round, as the Yes celebration's hole opens, with every game, its hint and power-up, and the last pick marked. Catch plays Catch, and Settings › Games now shows Catch. Tapping outside or Android back plays the last pick. The Weapon credit question comes after the pick, worded for that game. Replay doesn't ask; coming back to a round not yet played asks again. At the largest text the list scrolls. Win Zero never asks. |
| 53 | **Home's secret (Plus)** | On Home (under the **Game** tab), tap the Game credits count three times quickly, then again. Tap it three times slowly (about a second apart). Tap the "i". Then read the end of Settings › Games. Repeat the quick taps in Win Zero. | Each quick triple tap adds a Game credit, with a "+1 Free Game credit!" popup ("You found the secret stash."), the Yes chime and its buzz; **Sweet!** closes it. Slow taps do nothing. The "i" still opens the hint. Settings › Games ends with "Psst. Somewhere on Home, a little box hands out free games…". Win Zero does nothing. |
| 54 | **Xcode Release builds of both apps** | `npm run open:ios:plus`, then a Release run on an iPhone from Xcode. Then `npm run open:ios` and a Release run of Win Zero. Set a build number in each app's General tab, switch twice, and look again. | Plus is Plus: "Pick your game" before a round, and Settings shows Goals, Games, Themes and App icon. Win Zero shows none of these, and both apps stay installed side by side. Signing needs no team picked. Each General tab shows its own version (Win Zero's from `app.json`, Plus's `PLUS.version`) and keeps the build number set there. |
| 55 | **Home's tabs, Edit and Add goal (Plus)** | With 2 goals, open Home. Tap **Game**, start a round from a check-in or a bonus round, and come back. Tap **Goals**, pick the second goal, and tap **Edit**, then **Done**. Tap **Add goal**, then **Cancel**; then add a third goal and look again. Also at the largest text size and with VoiceOver / TalkBack. Then open Home with one goal. | The check-ins and Up next stay above the tabs. **Goals** opens first, with Your goals, the picked goal, its numbers and its calendar; **Game** shows the credits and the arsenal, and coming back from a round keeps the tab. **Edit** opens the goal picked, and Done returns Home. **Add goal** opens Add a goal while there's room, and is gone with 3 goals. Screen readers read the tabs as tabs, with the one shown selected; at the largest text, a long goal name wraps with Edit on its first line. With one goal, Home is the same, its one goal picked under Your goals: Edit opens it and Add goal opens Add a goal. |
| 56 | **The notice at the largest text** | At row 9's largest text sizes, tap **Not today** on a check-in, in both apps. On a test phone, reach a Reset and a Shielded notice too (row 3). | Each notice scrolls when it's taller than the screen, so **Got it**, **Check in now**, **Undo Not today** and the support line can all be reached. At normal sizes it sits centered and doesn't scroll. |
| 57 | **Flashes** | At `practice=60` (9 bombs), tap the bomb button as fast as possible, then clear the board with a bomb. Again with OS Reduce Motion on, and with **Reduce effects** on (row 61). | However fast the bombs go, the screen flashes at most about 3 times a second. A bomb that clears the board flashes once, as brightly as the final. With Reduce Motion or Reduce effects, each flash is a faint wash. |
| 58 | **Touch targets** | Run Android's Accessibility Scanner on Setup, Home (Plus with 2 goals too, both tabs), Settings, Add a goal, a goal's screen, Pick your game and a round's HUD. Then read Play's pre-launch report. | No touch-target suggestions, except the weekday toggles on a phone narrower than about 376 dp (see Known and accepted). Chips, small buttons, links, the "i" hints, the calendar arrows and the HUD buttons all take a tap anywhere on their 44 pt / 48 dp area. |
| 59 | **Edges and the Shielded mark** | Look at Setup, Settings and Add a goal: ghost buttons, chips, the goal field, time fields, weekday toggles, Home's tabs and the game picker's rows. Then a history calendar with Yes and Shielded days, in grayscale too (iOS: Color Filters). Then Home's arsenal, with weapons still locked. | Every control's edge stands out from its background. A Shielded day is a teal ring with a dot inside; a Yes is a ring alone; the legend matches. In grayscale the two are still told apart. Locked arsenal rows are dimmed by color, not faded, and read as easily as the rest (on the website too). |
| 60 | **Headings** | With VoiceOver, open Settings and use the rotor's Headings. | The app's name in the top bar is the first heading, then Settings, then each section in order: in Plus, Goals, Games, Themes and App icon; then Accessibility and About. |
| 61 | **Reduce effects** | OS Reduce Motion off. Settings › Accessibility › **Reduce effects** on. Look at Home, tap **Yes, I did**, play the round with a bomb, then tap **Not today** on another day. Then turn it off. | Home's background holds still, the Yes plays only its chime and haptic, the round shakes little with fewer particles and faint flashes, the notice's zero holds still, and popups appear without zooming. Off: everything moves again. |
| 62 | **Auto-fire** | Settings › Accessibility › **Auto-fire** on. Play a Shooter round: tap once and lift, tap elsewhere, then drag. In Plus, play Orbit, Breaker with the Laser Paddle switched on (row 23's links, `practice=1000`), Catch and Slice. Then turn it off. | The hint says "Tap to aim · firing keeps going". Firing starts at the first tap and keeps going toward the last tap or drag, and stops with the last zero. Breaker's Laser Paddle fires all the time; Catch and Slice play as before. Off: the hint says "Tap to shoot · hold to keep firing", and lifting stops firing. |
| 63 | **Finish round button** | With no screen reader, Settings › Accessibility › **Finish round button** on. Start a round, and tap **FINISH ROUND**. Then turn it off and start another. | The button shows in every round, in every game. It clears the board with the celebration, and the round counts as played. Off: it's gone, unless VoiceOver / TalkBack is on. |
| 64 | **Bold text** | Settings › Accessibility › **Bold text** on. Close and reopen the app, and look through Home, Settings, a round and its result sheet, also at the largest text size. Turn it off and reopen. On iPhone, turn on iOS Bold Text (Display & Text Size) with the switch off, and reopen. | Until the reopen, the row says "Close and reopen … to see it". Then all text but Bungee's is a weight heavier, and nothing clips or overlaps, even at the largest size. Off and reopened: the usual weights. With iOS Bold Text, the app's text is heavier with the switch off. |
| 65 | **Words for chosen days (Plus)** | In Plus's Setup, untick Saturday and Sunday. Add a goal on Mon, Wed and Fri and wait for its check-in, beside a daily goal's. Then play a Catch round on a Yes that unlocks a power-up, and tap **Share this milestone**. | Setup's rules say "On each check-in day…" and "The first 7 in a row cost nothing", and the field says "Your goal". The Mon/Wed/Fri goal's check-in is titled "Check-in time", the daily one "Daily check-in". The share text says "I unlocked a new catcher, …". Win Zero's Setup says "Every day at your check-in time" and "Nothing's lost for a week". |
| 66 | **Errors and "Saved." read aloud** | With VoiceOver, then TalkBack: in Settings, change the goal's wording and tap **Save goal**. In Plus, a goal's screen → **Lock-screen name** → **Save name**. With a Game credit, **Play a bonus round** and type 0 in Zeros, then 12. Then the same on winzero.app/play with the computer's screen reader. | Each save says "Saved. …" though its button goes away. "A whole number from 1 to 100,000, please." is read once as it appears, without moving focus, and isn't read again until it comes back. |
| 67 | **What a store build carries** | Before each store build, `npm run check:release:ios` (or `:plus`), or read the summary `build:android:upload` prints. Install the build and open Home, then Settings. | The check passes, and its note says whether Win Zero offers the move. About has the privacy and support links and the version. Win Zero 1.2.0 shows a "+" beside Home's goal heading and a **Win Zero Plus** section in Settings, whose links open Plus's store page; **Move to Win Zero Plus** opens it too when Plus isn't installed. A Win Zero build without the store pages shows none of them. With the `preview` profile's stand-in iOS page, the check stops. |
| 68 | **The home-screen name (Plus)** | Install Plus on the smallest phones at hand (an iPhone SE or mini, a narrow Android) with the largest text size. Look at the home screen, the app drawer, the share sheet and a notification. | "Win Zero Plus" in full, or as each launcher shortens long names. On iPhone it fits in full even at the largest size. |
| 69 | **Day 7 and Day 30 celebrations** _dev_ | On a test phone (never the tester's own progress: the jump rewrites the goal), in both apps and on winzero.app/play in demo mode: **Jump to day 7**, play the round to the end, and tap **Back to base**. Close the popup, then leave Home and come back. Move the debug clock on, **Jump to day 30**, and do the same. Then with sound off, haptics off, Reduce Motion, VoiceOver / TalkBack, and the largest text size. In Plus, also on a second goal, and in a game other than the Shooter. | Nothing shows over the round or the result sheet. Back on Home, with the Yes chime and buzz: "Congratulations on Day 7!", a quote, and an amber panel with a shield icon, "You earned a shield", the count and what it does. Day 30: Chain Zapper (or the game's own power-up), Ember in Plus only, and the bomb, each with its icon. **Keep going**, tapping outside, Escape or Android back closes it for good. A second goal's Day 7 shows nothing. Sound off: no chime; haptics off: no buzz; Reduce Motion: no pop. A screen reader starts at the title. At the largest text, the popup scrolls. |

### Known and accepted
- **A move can't prove it came from Win Zero on Android.** Any app can open Plus's import link
  with made-up data. Plus reads it as untrusted, shows exactly what would arrive, and asks first.
  On iPhone the data has to come from the shared folder.
- **Android reminders are inexact,** and can arrive a few minutes late. There's no exact-alarm
  permission; Play restricts it. The support page says so.
- **The support line is US-only** (SAMHSA). Localize it later.
- **Weekday toggles under 48 dp on narrow phones.** Seven toggles share the row, so below about
  376 dp of screen width each is narrower than Android's 48 dp (still 48 dp tall). The Scanner
  may say so for Plus's days picker.
