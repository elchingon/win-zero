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
| 6 | **Performance** | `eas build --profile perf --platform android`, then open `winzero://play?practice=60` and `winzero://play?practice=1000`, e.g. `adb shell am start -a android.intent.action.VIEW -d "winzero://play?practice=60"`. | About 60 FPS on the frame meter, with the worst frame under about 25 ms. A bomb over a full board still shows the three finale shockwaves. |
| 7 | **Reduce motion, silent switch, haptics off** | Turn on OS Reduce Motion. Flip the iPhone silent switch. Turn haptics off in Settings. Play a round each time. | Less shake and fewer particles. No sound when silenced. No buzz with haptics off. |
| 8 | **VoiceOver / TalkBack** | Home: swipe through, and use heading navigation. Calendar: change months. Arsenal, the check-in card, and a round. | Headings: Daily goal, Arsenal, History. The calendar reads a month summary and "today". Buttons say what they'd do. **Finish round** clears a round (also the VoiceOver two-finger double-tap). "Round cleared" is announced, then focus lands on "N zeros down". |
| 9 | **Largest text size** | iOS: Accessibility → Larger Text at maximum. Android: font size and display size at maximum. | Home and Settings stay readable, and the check-in and result buttons stack. The result sheet scrolls rather than running off the screen. The HUD stays in its bands. |
| 10 | **Icons and splash** | Home screen in light and dark (and tinted on iOS 18). Android themed icons on. A reminder in the status bar. Cold launch. | The brand zero shows everywhere, and the Android themed icon follows the wallpaper color. The status-bar icon is a full-size white zero. The launch splash plays, then Home. |
| 11 | **Release permissions** | `bundletool dump manifest --bundle app.aab` (or `aapt dump permissions` on a preview APK). | No storage or SYSTEM_ALERT_WINDOW permissions, and no exact-alarm permission. |
| 12 | **Fresh install and erase** | Install fresh, go through Setup and allow notifications. Then Settings → Erase all data. | The permission explanation shows before the OS prompt. After erasing, Setup shows and the pending count is 0. |
| 13 | **Answering the next evening** _dev_ | Leave a check-in unanswered. Move the debug clock to 9:00 PM the next day, then answer. Leave the next one unanswered and move the clock past the following midnight. | At 9:00 PM, Home asks about yesterday and says "Open until the end of today". That evening's notification has no buttons, and tapping it opens Home. After answering yesterday, today's card shows. Past midnight, the unanswered day is recorded as missed, and the day after it is still open. |
| 14 | **Changing the check-in time** | Leave yesterday's check-in unanswered. In Settings, set the check-in time a few minutes from now, then lock the phone. | Settings says "Next check-in: today at …" with the new time. The notification arrives then, without buttons while yesterday is open, and tapping it opens Home on yesterday's card. |

### Known and accepted
- **Android reminders are inexact,** and can arrive a few minutes late. There's no exact-alarm
  permission; Play restricts it. The support page says so.
- **The support line is US-only** (SAMHSA). Localize it later.
