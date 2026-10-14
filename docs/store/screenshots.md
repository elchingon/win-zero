# Store screenshots

## Sizes
- **App Store:**
  - 6.9" iPhone portrait, **1320 × 2868**. App Store Connect scales these down for smaller
    iPhones.
  - The app is iPhone only (`supportsTablet: false`), so no iPad shots are needed.
- **Google Play:**
  - At least 2 phone screenshots, portrait 9:16.
  - **1080 × 1920** or larger, so Play can feature them.
- **Number:** 6 to 8 per store.

## Capturing
- **iOS:**
  - Run the development build in the **iPhone 17 Pro Max** simulator (6.9"):
    `eas build --profile development-simulator --platform ios`, or `npx expo run:ios`.
  - Capture with `xcrun simctl io booted screenshot shot-N.png`.
- **Android:** use a 1080 × 2400 or larger emulator or phone. Capture with
  `adb exec-out screencap -p > shot-N.png`.
- **Before capturing:**
  - Set the status bar to a clean state: `xcrun simctl status_bar booted override --time 9:41
    --batteryLevel 100 --cellularBars 4`.
  - On Android, turn on demo mode in developer options.

Stage each shot with the development build's debug tools (**Settings → Debug clock**, or
**Demo controls** at the bottom of Home). Keep Demo controls folded and scrolled out of frame.

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
   - Caption: *Unlock seven weapons. Keep them for good.*
6. **History.**
   - Show: a month of the calendar with mostly Yes, one Not today and one missed day.
   - Stage it:
     1. Jump to day 20.
     2. **Next check-in**, then Not today.
     3. **Next check-in**, then Yes.
     4. **+1 day** twice, so one check-in closes unanswered (missed), then Yes on the open one.
   - Caption: *See your month at a glance.*
7. **Shielded.**
   - Show: the "Your shield held." notice.
   - Stage it:
     1. Jump to day 14 (2 shields).
     2. Answer Not today on 7 check-ins in a row with **Next check-in**. The 7th shows Shielded.
   - Caption: *Shields catch you on a hard week.*
8. **Privacy.**
   - Show: Settings with "Goal in reminders" off, and Need support?
   - Caption: *No account. Nothing leaves your phone.*

## Notes
- **Keep the copy supportive.** Avoid captions that shame, such as "Don't break the chain!"
- **Choose the goal text deliberately.** It shows in the screenshots, and everyday goals
  ("Read 20 minutes", "Exercise more") suit a broad audience. If you want the sobriety use case
  visible, use one shot with "Stop drinking", as in the prototype.
