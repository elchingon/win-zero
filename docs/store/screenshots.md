# Store screenshots

Win Zero Plus's shots are in `screenshots-plus.md`; how both sets are made is here.

## Sizes
Every export is a captioned image: the real capture, scaled down without stretching, under a
short caption on the app's navy. `npm run gen:store-shots` renders every size below from the raw
captures and checks it.

| Store slot | Export | Raw capture from | Shots |
| --- | --- | --- | --- |
| App Store, iPhone 6.9" | 1320 × 2868 | iPhone 17 Pro Max simulator, 1320 × 2868 | all ten |
| Google Play, phone | 1080 × 1920 | Pixel 7 emulator (`ofr_pixel7_api35`), 1080 × 2400 | 1–6 and 8 |
| Google Play, 7" tablet | 1080 × 1920 | Nexus 7 emulator (`ofr_tablet7_api35`), 1200 × 1920 | 1–6 and 8 |
| Google Play, 10" tablet | 1620 × 2880 | Pixel Tablet emulator (`ofr_tablet10_api35`), in portrait, 1600 × 2560 | 1–6 and 8 |

- **App Store:** Apple scales the 6.9" set down for smaller iPhones. The app is iPhone only
  (`supportsTablet: false`), so no iPad shots. Up to 10 per set.
- **Google Play:** 24-bit PNG, no alpha, 9:16, each side 1,080–7,680 px for tablets (the phone
  slot allows 320–3,840 px and at most 2:1, so a raw 1080 × 2400 isn't accepted; the export
  recomposes it). At least four, up to eight per device type. Play shows the app on tablets
  because Android has no iPhone-only switch.
- **Captions:** at most 18% of the image height (Play asks for 20% or less).

Sources: [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/),
[Google preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB).
Recheck both before uploading; the composer's sizes are in `scripts/store-shots/shots.json`.

## Making them
The captures come from the **development build**, driven by [Maestro](https://maestro.dev) through
the real UI and the debug tools (Jump to day, the debug clock, Send test check-in). Those tools
rewrite progress, so this runs only on simulators and emulators: the driver refuses any Android
serial that isn't an emulator.

1. **Tools:** `brew install mobile-dev-inc/tap/maestro` (needs Java 17). The iOS simulator needs no
   Simulator.app: `xcrun simctl` boots it, and Maestro taps it headless.
2. **Builds** (once per app):
   - iOS: `node scripts/prebuild.mjs ios` (or `EXPO_PUBLIC_APP_VARIANT=plus …` for Plus), then
     `xcodebuild -workspace ios/WinZero.xcworkspace -scheme WinZero -configuration Debug
     -destination 'platform=iOS Simulator,id=<udid>' -derivedDataPath build/ios-sim/free build`
     and `xcrun simctl install <udid> build/ios-sim/free/Build/Products/Debug-iphonesimulator/WinZero.app`.
     Plus's workspace and scheme are `WinZeroPlus`. Put `ios/` back to the app you build in Xcode
     afterwards.
   - Android: `node scripts/prebuild.mjs android`, `cd android && ./gradlew :app:assembleDebug`,
     then `adb -s emulator-<port> install android/app/build/outputs/apk/debug/app-debug.apk` on
     each emulator. Plus needs `EXPO_PUBLIC_APP_VARIANT=plus` on both commands.
3. **Metro** for the app: `npm start` for Win Zero (port 8081), and
   `npm run start:plus -- --port 8082` for Plus. Both can run at once.
4. **Capture**, one device at a time:
   `npm run capture:store-shots -- --app free --device ios-6.9` (devices: `ios-6.9`,
   `android-phone`, `android-tablet-7`, `android-tablet-10`, in `scripts/store-shots/devices.json`).
   The driver boots the device, sets a clean status bar (9:41, full battery; Android demo mode),
   dark mode, and runs every step in order. The Pixel Tablet is landscape by nature and would
   letterbox the portrait app, so the driver lets the app turn it upright
   (`cmd window set-ignore-orientation-request false`). On Android it also snoozes other
   notifications before the notification shot. `--from <step>` resumes after a failure and
   `--only <step,…>` reruns some.
   Raw captures land in `store-shots/raw/<app>/<device>/<slug>.png`.
5. **Pick the action frames.** Steps that capture mid-action save a burst of frames in
   `store-shots/raw/<app>/<device>/bursts/<slug>/`. Look through them and copy the best one into
   place: `npm run capture:store-shots -- pick --app free --device ios-6.9 round f028`.
6. **Compose:** `npm run gen:store-shots` (or `-- --app free`) writes
   `store-shots/final/<app>/<slot>/NN-slug.png`, numbered in each store's upload order
   (`order` in `shots.json`; a shot not captured on a device is left out), plus a contact sheet
   per slot. Look at every image at phone size before uploading. `store-shots/` is gitignored.

**Check every raw capture** for things that mustn't ship: the dev-only "Demo controls" link or
debug section, a LogBox warning, a real reminder banner landing mid-shot, or the frame meter.

## Shot list and upload order
Upload in this order. The App Store gets all ten. Play gets 1–6 and 8 on each device: shots 7,
9 and 10 take the longest to stage, and the driver stages them on iOS only. The goal is **Read 20
minutes**, with the default 8:00 PM check-in. Captions and sublines are in
`scripts/store-shots/shots.json`.

| # | Shot | How the run stages it | Caption / subline |
| --- | --- | --- | --- |
| 1 | Home with the check-in open: "Did you stick to "Read 20 minutes" today?" | **Next check-in** after the Day 50 round | One question a day. / At a time you choose. |
| 2 | A Day 50 round mid-fire, **at least 35 zeros left**, Chain Zapper lightning on screen | **Jump to day 50**, single taps, a burst of frames | Every Yes is a zero to shoot. / Day 50 · Chain Zapper, earned at day 30 |
| 3 | The cheer after the round, over the celebration fill: "You kept a promise to yourself today. That's no small thing." | **Finish round button** on, Finish round, then Replay until that line comes up | Every round ends with a cheer. / Encouragement, never shame. |
| 4 | The check-in notification with **Yes, I did / Not today** | **Goal in reminders** on, **Send test check-in**; iOS long-presses the banner, Android opens the shade | Answer straight from the notification. |
| 5 | Settings › Accessibility: Auto-fire and Finish round button on | After shot 3 | Play your way. / Auto-fire, a Finish round button, softer effects and bold text. |
| 6 | Home: credits and the arsenal, Chain Zapper equipped | After the Day 50 round | Seven weapons to earn. / Yours for good as your best run grows. |
| 7 | "Your shield held." (App Store only) | **Jump to day 14** (two shields), then seven Not todays in a row with **Next check-in** | Gentle streak rules. / A shield can save your streak. |
| 8 | The top of Settings: Goal in reminders off | Before shot 4 | No account. No ads. / Reminders keep your goal off the lock screen. |
| 9 | The result sheet over the Day 100 fill: Zero Nuke unlocked (App Store only) | **Jump to day 100**, Finish round | Clear the last one for the big finish. / Zero Nuke, earned through check-ins |
| 10 | A month of the calendar: mostly Yes, one Not today, one missed (App Store only) | Jump to day 20, Not today, Yes, then **+1 day** ×2 and **+1 hour** ×4 so a check-in closes unanswered, then Yes | Your month at a glance. |

The first three carry the listing's promise: a daily question, an arcade reward, and support
rather than shame. Shot 4 backs "answer straight from the notification", 5 the accessibility
settings, 7 the gentle streak rules and 8 the privacy section. These are an editorial order to
test, not a measured winner (`review.md`).

## Notes
- **Keep the copy supportive.** Avoid captions that shame, such as "Don't break the chain!"
- **Show earned features honestly.** Shots past day one say what was earned and when (the
  sublines on shots 2 and 9). Nothing suggests later weapons come unlocked at first launch.
- **Accessibility claims:** the caption names the settings. Don't add VoiceOver or TalkBack
  claims until the device QA in `docs/RELEASE.md` passes (`listing.md`, Before pasting).
- **Tablets show the phone layout.** Home and Settings run edge to edge on a tablet (there's no
  tablet layout), and the round fills the screen. The tablet shots show that honestly.
- **Choose the goal text deliberately.** Everyday goals suit a broad audience. If you want the
  sobriety use case visible, use one shot with "Stop drinking", as in the prototype.
- **Optional preview:** a short portrait recording of check-in → round → result can explain the
  unusual loop. Use actual footage of the submitted experience.
