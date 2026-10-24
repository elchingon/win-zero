# Store screenshots

## Sizes
- **App Store:**
  - Capture large iPhone portrait at **1320 × 2868**, plus a medium Dynamic Island iPhone at
    **1206 × 2622** if requested by the current App Store Connect media slots. Recheck the live
    size requirements when uploading; do not assume a historical 6.9" slot covers every slot.
  - The app is iPhone only (`supportsTablet: false`), so no iPad shots are needed.
- **Google Play:**
  - Two is the publishing minimum; prepare **at least four** at **1080 × 1920**, portrait 9:16,
    for the app recommendation formats. Use six to eight for the full story.
  - JPEG or 24-bit PNG, no alpha. The longest side must be at most twice the shortest side,
    with dimensions between 320 and 3840 px. A raw **1080 × 2400 is not accepted** under that rule.
- **Number:** 6 to 8 per store.

Sources: [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/),
[Google preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB).

## Capturing
- **iOS:**
  - Run the development build in the **iPhone 17 Pro Max** simulator (6.9"):
    `eas build --profile development-simulator --platform ios`, or `npx expo run:ios`.
  - Capture with `xcrun simctl io booted screenshot shot-N.png`.
- **Android:** use an emulator configured to **1080 × 1920**. Capture with
  `adb exec-out screencap -p > shot-N.png`.
- **Before capturing:**
  - Set the status bar to a clean state: `xcrun simctl status_bar booted override --time 9:41
    --batteryLevel 100 --cellularBars 4`.
  - On Android, turn on demo mode in developer options.

Stage on a **disposable test install** with the development build's debug tools (**Settings →
Debug clock**, or **Demo controls** at the bottom of Home). These change progress; do not use a
personal streak. Keep Demo controls folded and scrolled out of frame. Final exports must match the
submitted build: no debug labels, frame meters or features absent from production. Capture each
platform's own UI. Recompose within the export canvas if needed; never stretch the interface.

## Upload order and design

Capture numbers below are staging references. Upload in this order: **1, 2, 5, 6, 7, 3, 4, 8**.
The first three explain the daily question, arcade reward and lasting progression. Keep one
benefit per image, use a consistent type/spacing system, and check legibility at actual phone
listing size. Favor the app UI over decoration; for Play, keep any caption within 20% of the image.
Do not add rankings, testimonials, prices or install calls to action.

## Shot list
1. **The check-in.**
   - Show: Home with the check-in card open, "Did you stick to "Read 20 minutes" today?"
   - Stage it: create the goal "Read 20 minutes", then **Jump to day 12**. After the round, use
     **Next check-in**.
   - Caption: *One question a day.*
2. **A round in play.**
   - Show: a Day 30 round mid-fire, with the Chain Zapper.
   - Stage it: **Jump to day 30**, then hold to fire. Capture with lightning on screen.
   - Caption: *Every Yes is a zero to shoot.*
3. **The celebration fill.**
   - Show: the screen filled with zeros and the result sheet up. "30 zeros down", with the new
     weapon line.
   - Caption: *Clear the last one for the big finish.*
4. **Armored zeros.**
   - Show: a Day 250 round, showing the ×10 armored zeros and a bomb going off.
   - Stage it: **Jump to day 250**, then tap the bomb.
   - Caption: *Long runs bring bigger rounds.*
5. **Home.**
   - Show: the streak, best run, bombs, shields, and the arsenal with progress to the next
     weapon.
   - Stage it: after Day 30, go back to base and scroll so the stats and arsenal fill the frame.
   - Caption: *Seven weapons. Yours as you progress.*
6. **History.**
   - Show: a month of the calendar with mostly Yes, one Not today and one missed day.
   - Stage it:
     1. Jump to day 20.
     2. **Next check-in**, then Not today.
     3. **Next check-in**, then Yes.
     4. **+1 day** twice, then **+1 hour** four times. The clock passes midnight, so the skipped
        check-in closes unanswered (missed). Then Yes on the open one.
   - Caption: *See your month at a glance.*
7. **Shielded.**
   - Show: the "Your shield held." notice.
   - Stage it:
     1. Jump to day 14 (2 shields).
     2. Answer Not today on 7 check-ins in a row with **Next check-in**. The 7th shows Shielded.
   - Caption: *A shield can save your remaining streak.*
8. **Privacy.**
   - Show: Settings with "Goal in reminders" off, and Need support?
   - Caption: *No account. No ads. Local progress.*

## Notes
- **Keep the copy supportive.** Avoid captions that shame, such as "Don't break the chain!"
- **Choose the goal text deliberately.** It shows in the screenshots, and everyday goals
  ("Read 20 minutes", "Exercise more") suit a broad audience. If you want the sobriety use case
  visible, use one shot with "Stop drinking", as in the prototype.
- **Show earned features honestly.** A Day 250 round can show high-level weapons, but later shots
  must not suggest they come unlocked at first launch. Add an "Earned through check-ins" caption
  where the context is otherwise unclear.
- **Optional preview:** a short portrait recording of check-in → round → result can explain the
  unusual loop. Use actual footage of the submitted experience; judge it against the screenshots
  before making it the first thing visitors see.
