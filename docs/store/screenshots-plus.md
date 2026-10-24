# Store screenshots: Win Zero Plus

Win Zero's own shots are in `screenshots.md`. Plus's show what only Plus does, so a reviewer, and
anyone choosing between the two apps, can understand the functional differences. This does not
guarantee acceptance under either store's duplicate/repetitive-app policy; see `review.md`.

## Sizes
The same as Win Zero's:
- **App Store:** **1320 × 2868** portrait, and **1206 × 2622** for the medium Dynamic Island slot
  if requested by the current console. Plus is iPhone only, so no iPad shots.
- **Google Play:** prepare at least **four 1080 × 1920** portrait screenshots for app recommendation
  formats (two is only the publishing minimum). Export JPEG or 24-bit PNG without alpha.
- **Number:** 6 to 8 per store.

See `screenshots.md` for current specification links and export checks. A raw 1080 × 2400 exceeds
Play's maximum 2:1 dimension ratio. Capture at the target ratio, without stretching the UI.

## Where to stage them
**On a test install, never on a phone whose progress matters.** Most shots use **Jump to day**,
which rewrites a goal's history and can change shared unlocks (archiving or deleting a goal can
preserve its unlocks). A test install is a Plus development build on:
- **iOS:** the iPhone 17 Pro Max simulator (6.9"), via `npm run open:ios:plus` and a Debug run.
  This Mac's Xcode 27.1 has no Simulator.app, so the simulator runs without a window and can't be
  tapped: use a Mac whose Xcode has it, or a spare 6.9" iPhone.
- **Android:** a **1080 × 1920** emulator with `npm run start:plus`.

**No step uses the debug clock.** Use Jump to day to stage a real check-in round, then select its
game and theme through the normal UI. Practice links show a frame meter and should not supply the
final store images. Keep earned theme/power-up captions clear. Use each platform's own UI.

**Before capturing:**
- iOS status bar: `xcrun simctl status_bar booted override --time 9:41 --batteryLevel 100
  --cellularBars 4`. Android: demo mode in developer options.
- Capture with `xcrun simctl io booted screenshot shot-N.png`, or
  `adb exec-out screencap -p > shot-N.png`.
- Keep Home's **Demo controls** folded and scrolled out of frame, and Settings' debug section
  scrolled out of frame.
- Set the check-in times so the shots read naturally: the goals below are set up with check-in
  times **earlier today**, except "Stretch", which checks in **later today** so Home has something
  Up next.

## Setting up the test install
Stage on a weekday, so Walk after dinner has a check-in today.
1. Setup: goal **Read 20 minutes**, every day, check-in time earlier today.
2. Settings → Goals → **Add a goal**: **Walk after dinner**, Monday to Friday, check-in time earlier
   today. Leave its check-in unanswered.
3. **Add a goal** again: **Stretch**, Monday, Wednesday and Friday, check-in time later today.
4. Settings → debug section → **Jump to day**: pick **Read 20 minutes** and tap **Day 30**. A jump
   also answers that goal's open check-in, so its Day 30 round is now ready.

## Shot list
1. **Three goals on Home.**
   - Show: Home with "Your Day 30 round is ready" over Read 20 minutes, the open check-in for Walk
     after dinner, and **Up next** with Stretch. Frame the main cards legibly; do not try to cram
     the calendar and all tabs into one image.
   - Stage it: the setup above. Don't play the round yet.
   - Caption: *Up to three goals, one place.*
2. **Pick your game.**
   - Show: the **Pick your game** list, with every game, its hint and power-up.
   - Stage it: on Home, **Play now** on the Day 30 round. Capture the list, then pick **Catch** and
     play the round out (or leave it).
   - Caption: *Pick your game before every round.*
3. **Catch, in Neon Arcade.**
   - Show: zeros bouncing high over the cups, mid-round.
   - Stage it: Jump Read 20 minutes to **Day 60**, select **Neon Arcade** in Settings → Themes,
     then Home → **Play now** → **Catch**. Slide the cups under a falling zero and capture as it
     bounces. Finish or leave the round before staging the next one.
   - Caption: *Five games, one streak.*
4. **Breaker, in Aurora.**
   - Show: a wall of zero-bricks, steel on top, with the ball mid-flight.
   - Stage it: Jump Read 20 minutes to **Day 250**, select **Aurora** in Settings → Themes,
     then **Play now** → **Breaker**. Switch to **Multi-ball** with the power-up button, and
     capture with several balls up.
   - Caption: *Aurora theme earned at a best streak of 180.*
5. **Slice, in Gold Year.**
   - Show: a blade trail cutting across a wave of zeros.
   - Stage it: Jump Read 20 minutes to **Day 365**, select **Gold Year** in Settings → Themes,
     then **Play now** → **Slice**. Swipe through a wave and capture mid-swipe.
   - Caption: *Gold Year theme earned at a best streak of 365.*
6. **Check-in days.**
   - Show: **Add a goal** with Monday, Wednesday and Friday picked, reading "Mon, Wed, Fri".
   - Stage it: during setup step 3, with **Stretch** typed and its days picked, capture before
     tapping **Add goal**.
   - Caption: *Check in on the days that count.*
7. **Rest days on the calendar.**
   - Show: Walk after dinner's month: Yes rings on weekdays, the muted rest-day dashes on weekends.
   - Stage it: after shots 1 and 2, **Jump to day**: pick **Walk after dinner**, type **20**, **Go**.
     Then Home → **Goals** → **Your goals** → Walk after dinner, and scroll to its calendar.
   - Caption: *Rest days are just rest.*
8. **Themes and app icons.**
   - Show: Settings → **Themes**, with all seven open, and **App icon** below it.
   - Stage it: last, since it opens everything. **Jump to day**: pick **Read 20 minutes**, type
     **365**, **Go**. Then Settings, scrolled to Themes, with Gold Year picked.
   - Caption: *Four themes included. Three more to earn.*

## Upload order and design

Upload **1, 6, 3, 2, 7, 8, 4, 5**: multiple habits, a flexible schedule, then the arcade payoff.
These are a proposed sequence to test, not a measured conversion winner. Keep one readable
benefit per image, consistent typography and spacing, and captions within 20% of Play images.
The first three should foreground actual UI. Keep debug controls and performance meters out.

## Notes
- **Keep the copy supportive.** Avoid captions that shame, such as "Don't break the chain!"
- **Choose the goal text deliberately.** Everyday goals suit a broad audience. If you want the
  sobriety use case visible, make one goal "Stop drinking", as in Win Zero's shots.
- **Don't show prices or "Pro" badges** in the shots: there are none in the app, and nothing is for
  sale inside it.
