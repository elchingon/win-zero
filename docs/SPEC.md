# Win Zero: Product & Game Spec

Version 0.6 · October 18, 2026 · Owner: e7sal

Win Zero is a daily habit app for iOS and Android. The user sets one daily goal (for example "Stop drinking" or "Exercise more"); Win Zero Plus allows up to three (section 9). Every day, at a check-in time the user picks, the app asks whether they did it. Each "yes" adds a zero to a shooting round. The streak is the number of zeros on screen.

The playable web prototype at `docs/prototype/win-zero.html` sets the **look, feel, and game juice**: palette, fonts, explosions, the final-zero celebration, and the screen filling with zeros. Open it in a browser. **Where the prototype's rules differ from this spec, this spec wins.** The prototype predates sections 3–6.

---

## 1. Core loop

1. User sets a goal and a check-in time (default 8:00 PM local).
2. At check-in time, a notification asks: *Did you stick to "<goal>" today?* with **Yes** and **Not today** buttons.
3. **Yes** from the notification opens the app on Home, with a shooting round of `streak` zeros ready to play whenever the user likes. **Yes** on Home's check-in card starts the round straight away. A player holding a Weapon credit is asked first whether to use one (section 5).
4. Shooting the last zero triggers the big celebration explosion. Then the screen fills with `streak` giant zeros, a line of encouragement pops up with a horn fanfare, and a result sheet appears.
5. Rewards (weapons, bombs, shields, credits) are granted on the result sheet. A Game credit the Yes earned gets its own popup first (section 5).

## 2. Check-in windows

Each goal day `D` has one answer window. It is generous on purpose: this is a supportive app, and a busy evening shouldn't cost anything.

- **Opens:** check-in time on day `D` (first notification).
- **Second reminder:** the next time the clock reads the reminder time (default 9:00 AM) after the window opens. Set earlier than the check-in time, that's the next morning, day `D+1`, and it asks *"Did you stick to '<goal>' yesterday?"*. Set later than the check-in time, for shift workers (say check-in 6:00 AM after a night shift, reminder 2:00 PM after sleeping), it comes later on day `D` and asks about *today*. Set to the check-in time, it isn't sent on its own: day `D+1`'s check-in already says yesterday's is still open, so there's one notification a day.
- **Closes:** midnight at the end of day `D+1`, on the clock in the time zone the window opened in. It never closes before day `D+1`'s window opens.

With the defaults, Monday can be answered from 8:00 PM Monday until midnight Tuesday night. If a window closes unanswered, day `D` is **missed** (see section 3).

Day `D+1`'s window opens at its own check-in time, so the two overlap until midnight. Days still settle strictly in order: Home asks about the earliest open day first, then the next. While yesterday is still open, today's check-in notification has no Yes / Not today buttons (a Yes couldn't say which day it means). Tapping it opens Home. Once yesterday is answered, today's is rescheduled with its buttons.

Notifications are **local** (scheduled on device; no push server needed for v1):

- While a day is unanswered, send 2 reminders per day (evening check-in + morning reminder).
- Pre-schedule reminders for every window up to the one whose miss would reset the streak (section 3), at most 14 windows ahead. That reset lands at midnight after the next day, so the next day's evening check-in still goes out: answering then keeps the streak. On every check-in or app open, cancel and reschedule.
- Every notification opens the app on Home.
- Reminders stop once a run of missed days resets the streak (section 3). After that, send one gentle re-engagement notification per week (setting, default on). Any answer brings daily reminders back.

## 3. Streak rules (the rules engine)

State fields: `streak`, `bestStreak`, `shields`, `bombs`, `consecutiveMissed`, `slide`, `paused`, `history[]`.

The streak **slides** rather than snapping to zero, so one hard day doesn't wipe out a long run. A **slip** costs one zero; the 7th slip since the last Yes is the **final**.

| Event | Effect |
|---|---|
| **Yes** for day D | `streak += 1`; `bestStreak = max(bestStreak, streak)`; `consecutiveMissed = 0`; `slide = 0`; `paused = false`; grant rewards (section 5); play a round with `streak` zeros. |
| **Not today** for day D | `consecutiveMissed = 0`; `paused = false`; then one **slip**. History records `no` (or `shielded`). |
| **Missed** day D, 1st–7th in a row | Grace: nothing lost. `consecutiveMissed += 1`. History records `missed`. |
| **Missed** day D, 8th+ in a row | `consecutiveMissed += 1`, then one **slip**. If that slip resets the streak, `paused = true`: daily reminders stop (section 2). |
| **Missed** while `paused` | Recorded as missed (paused). Counts toward nothing. |
| **Slip** #1–#6 | `slide += 1`; `streak = max(0, streak - 1)` (lose one zero). |
| **Slip** #7: the final | If `shields > 0` and `streak > 0`: consume 1 shield, streak unchanged, history records `shielded`, show the shield-absorb animation. Otherwise `streak = 0` and show the encouraging final screen. Either way `slide = 0`. |

Notes:
- `slide` counts slips since the last Yes (or the last final). Grace misses neither add to it nor clear it.
- A shield is only spent when there's a streak to protect, and never on an ordinary slip.
- Bombs and shields are only granted above the run's previous peak, so slipping and climbing back can't earn the same milestone twice.
- `bestStreak` never decreases. It drives weapon unlocks.
- Missed days are resolved lazily. On app open, on notification response, or in a background task, run `resolve(state, now)` to walk every closed window since the last resolution. It must be idempotent and handle the app being closed for weeks.
- All date math uses the user's local timezone and must survive DST changes and travel. Store the timezone with each history entry.

### Decisions (v0.3)
1. Shields protect only the final slip, whether it comes from a Not today or a missed day.
2. Shields are used automatically, with an animation.
3. Missed days at `streak = 0` still count toward the reset that pauses reminders.

## 4. Round composition

`composeRound(n)` is a pure function returning the zeros for a round. Values are tunable constants in `engine/round.ts`.

**Days 1–7 (`n ≤ 7`): energy-bar zeros**
- Every zero has `hp = max(3, ceil(12 / n))`, giving 12 / 6 / 4 / 3 / 3 / 3 / 3.
- Each zero shows an energy bar that drains per hit, with a small hit flash and spark burst per hit.

**Days 8–60: standard zeros**
- `hp = 1`, no energy bar. Size scales down with count (see prototype `zeroRadius`).

**Days 61+: armored zeros**
- On-screen object cap: **60**.
- Armored zeros each count as `V` zeros. Pick the smallest `V` in `[10, 25, 50, 100]` where a solution exists with `regular + V * armored = n` and `regular + armored ≤ 60`, maximizing `regular`. Example: n = 61 → 1 armored (×10) + 51 regular; n = 250 → 22 armored + 30 regular.
- Armored HP: `5 + floor(n / 100)`, capped at 12. They render thicker with a metallic stroke, an energy bar, and a `×10` badge, and move slower.
- Destroying one triggers a bigger explosion and drops the counter by `V`.

The HUD counter always shows **zero value remaining**, not object count.

**Celebration fill:** after the last kill, fill the screen with `n` zeros in a grid (prototype `layoutFill`), capped at 500 glyphs. Above 500, draw 500 and overlay the full number large.

## 5. Rewards

**Weapons unlock by `bestStreak` and are never lost.** The player can switch among unlocked weapons in the HUD. The highest unlocked weapon is the default.

| Unlock (best streak) | Weapon | Damage model |
|---|---|---|
| 1 | Pea Shooter | 1 bullet, 1 dmg |
| 3 | Twin Barrel | 2 parallel bullets, 1 dmg each |
| 7 | Scatter Gun | 5-pellet fan, 1 dmg each |
| 14 | Rocket | 3 dmg direct, 2 dmg splash radius |
| 30 | Chain Zapper | 2 dmg direct, then 1 dmg to 4 nearest |
| 60 | Rail Laser | 2 dmg to every zero on the line |
| 100 | Zero Nuke | 6 dmg direct, 3 dmg splash, chain to 6 |

A tap shoots, and holding keeps firing at about 6 shots/sec (the hint: "Tap to shoot · hold to keep firing"). With **Auto-fire** on (Settings › Accessibility), the first touch starts firing and lifting doesn't stop it, so touches only aim; it applies wherever the finger fires (the Shooter, Orbit, Breaker's Laser Paddle).

**Bombs:** +1 every time `streak` hits a multiple of 5. Banked and never lost. Using one deals 8 dmg to every zero within 42% of the screen's longest side.

**Streak shields:** +1 every time `streak` hits a multiple of 7. Maximum 3 banked. Consumed per section 3.

### Credits

Two banked currencies, spent only when the player chooses. They live in a wallet beside the goal (`src/engine/credits.ts`), not inside it, so a new goal keeps them. **Erase all data** clears them with everything else.

- **Game credit:** plays a **bonus round** of any number of zeros from 1 to 100,000, chosen on Home. The credit is spent when the round is started; the round then waits on Home until played, so a closed app never loses it, and only one waits at a time. A bonus round changes nothing: no streak effect, no rewards, and free bombs as many as are banked, like a replay. Replay keeps it a bonus round. The HUD reads **BONUS**.
- **Weapon credit:** lends one weapon not yet unlocked for one round and its replays, a daily round or a bonus round. Before a round not yet played, a player holding a Weapon credit, with a weapon still locked, is asked **Use a Weapon credit?**, with each locked weapon listed like the arsenal, or **Not this time** (tapping outside, Escape and Android back too; on the web the keyboard starts there). The borrowed weapon starts equipped, the HUD switch cycles it with the unlocked ones, and it never becomes the saved pick. The borrow is saved on the round, so coming back to it doesn't ask again, and a round that goes unplayed takes its borrow with it. One per round. With every weapon unlocked there's nothing to ask, and credits wait for new weapons.

**Earning.** A one-time reward pays once per install, keyed by its id. It tests whether its mark has been reached, so a player already past it collects it the next time it's checked: a save from before credits gets the goal's credit when it's upgraded, and the rest on the next Yes. A repeating reward (**every**) pays at the Yes that reaches each of its marks, keyed by its id, the goal and the day, so each mark pays once and each goal's runs pay their own (section 9). A mark already passed isn't paid later.

| Reward | Credit |
|---|---|
| Setting the goal | +1 Game |
| The Yes that makes 3 zeros (`streak` ≥ 3) | +1 Game |
| Every 7 Yeses in a row (7, 14, 21, …) | +1 Game |
| The first Yes after an unanswered day (a Not today doesn't count) | +1 Weapon |
| 3 Yeses in a row | +1 Weapon |
| 14 Yeses in a row | +1 Weapon |
| Every 30 Yeses in a row (30, 60, 90, …) | +1 Weapon |

**In a row** counts consecutive check-ins answered Yes, apart from the sliding `streak`: any other day (a Not today, a shielded day, a missed day) starts it over, even one of the free missed days. A new run pays its every-7 and every-30 marks again.

The 3-zero credit took over from a 2-zero one, and every 30 in a row from a one-time 30: a player already paid the 2-zero credit isn't paid the 3-zero one, and a round saved with an old reward still says why it paid.

**Revealing a Game credit.** Credits are banked at the Yes, so a closed app never loses one. A Game credit the Yes earned is revealed after its round is first played to the end: once the encouragement is dismissed, a popup shows a big **+1**, "Game credit earned!", why, and how many there are now, with the Yes chime and a success haptic. **Nice!**, tapping outside, Escape or Android back dismisses it, and the result sheet rises, listing it with the rest. Replays, bonus rounds and practice show none. After a notification's Yes, Home's count shows the credit while the round waits.

New ways to earn (accomplishments) are new entries in `CREDIT_REWARDS` (`src/engine/creditRewards.ts`). Credit packs, if they come, grant into the same wallet keyed by the purchase's transaction id, so a purchase delivered twice pays once.

On the website, practice rounds (any size, every weapon) run only in demo mode, on a copy of the progress. Outside it, a round of any size is a bonus round.

## 6. Screens

- **Onboarding / Setup:** goal (free text plus suggestion chips), check-in time, reminder time (any time of day), notification permission request with a short explanation first. Set up after the check-in time, today counts: today's check-in is open straight away, and both Setup's last step and Home (until the first answer) say so plainly.
- **Home:** goal, current streak, best run (with the dates it ran), Yes days in all and this month, bombs, shields; pending check-in card (same Yes / Not today as the notification; a Yes tapped there celebrates on the way into the round: a zero pops out of the button with a burst of mini zeros, a chime and a small haptic, dark floods out from it, and its hole opens onto the round. Under reduced motion, only the chime and haptic); credits: Game and Weapon counts, each with a hint (a small "i" in its corner) that opens what the credit does, how to spend it and every way to earn one, the one-time ones already earned marked; a bonus round waiting to be played or **Play a bonus round** (a sheet to choose the size, typed or from 10 · 100 · 1,000 · 10,000); arsenal list with next-unlock progress; history calendar (yes / no / shielded / missed; a shielded day has a dot inside its ring, so it isn't told from Yes by color alone). While reminders are off (never turned on, or off in system settings), a card offers to turn them on; its "Not now" hides it for a week.
- **Play:** full-screen Skia canvas, HUD (value left, day or BONUS, weapon switch, bomb button, sound toggle), turret at bottom center. `/play?round=bonus` plays the bonus round. Before a round not yet played, the Weapon credit question comes first (section 5); in Win Zero Plus, the game picker before it (section 9).
- **Encouragement:** when the fill lands after a real round or a replay, a popup over the zeros shows one line of encouragement, picked at random with no repeat back to back (`src/ui/copy/cheers.ts`). A short horn fanfare and a light haptic play as it appears, following the sound and haptics settings. **Got it**, tapping outside, Escape or Android back dismisses it; then the popup for a Game credit the Yes earned, if any (section 5), and the result sheet rises. None in practice or bonus rounds, which have no check-in to cheer.
- **Result sheet:** over the filled screen, showing day (or "Bonus round"), "N zeros down", rewards earned (credits too: "Weapon credit earned for 3 Yeses in a row. You have 1."), next unlock (not after a bonus round), and buttons for Back to base and Replay (replay has no streak effect). A round that earned something (a weapon, a bomb or a shield; credits alone don't count) offers **Share this milestone**: plain text through the phone's share sheet, for example "Day 30 on Win Zero: 30 zeros down. I unlocked the Chain Zapper." It never includes the goal's wording.
- **Reset / Shielded / Slipping:** supportive copy, never shaming. Slipping covers any slip that cost a zero, from a Not today or from missed days found on opening: "You've lost a zero. Check in to stop the slide." The final shows Reset (encouraging) or Shielded. After a Not today, the screen offers **Undo Not today** for 10 seconds (30 with a screen reader on), in case it was a mis-tap: the goal and round go back to just before the answer, as long as that check-in is still open.
- **Settings:** edit goal and times, sound/haptics, re-engagement toggle, erase data, support link, an **Accessibility** section (below), an **About** section (privacy policy, support page, support email, app version), and **How it works**: the rules in plain words (the daily question, the slide and the final, a fresh run, missed days, banked rewards, credits), with numbers and ways to earn taken from the engine.
- **Settings › Accessibility:** four switches, all off by default, because each changes the app for whoever turns it on:
  - **Reduce effects:** what the phone's Reduce Motion does, without changing the whole phone: less shake, much dimmer flashes and fewer particles in rounds, a still Home background, notice zero and Yes celebration, and no entering animations. Always on while the phone's Reduce Motion is.
  - **Auto-fire:** after the first touch in a round, firing keeps going; touches only aim (section 4).
  - **Finish round button:** shows **Finish round** in every round, as a screen reader does.
  - **Bold text:** heavier Barlow and JetBrains Mono everywhere (Bungee has one weight). Fonts load at launch, so it shows from the next one, and the row says so when a reopen is needed. Always on while iOS's Bold Text is.

**Support link:** goals like quitting drinking are health-related. Settings should include a "Need support?" row, and the Slipping and Reset screens link to it too. In the US, list the SAMHSA National Helpline, 1-800-662-4357 (free, confidential, 24/7). On a device that can't place calls (an iPad, say), tapping it shows the number to call from any phone, and SAMHSA's text option, instead of failing silently. Localize later.

## 7. Visual identity (from the prototype)

- Palette: ink `#0D1130`, ink-2 `#151A44`, panel `#1B2150`, panel-2 `#252C68`, line `#353D80` (dividers), edge `#7078BC` (control edges and marks that carry meaning, 3:1 or more on every surface), fg `#F5F0E6`, muted `#AAB0D8`, amber `#FFB52E` (primary), amber-deep `#B9770A`, flare `#FF4F6D` (danger/bombs), teal `#3FDCCB` (weapons/success).
- Type: **Bungee** (display, zeros, buttons), **Barlow** (body), **JetBrains Mono** (labels, HUD numbers).
- Dark-only app. Zeros are oval rings in a rotating amber / flare / teal / fg palette with glow.
- Game feel: screen shake, hit flash, particle bursts, shockwave rings, haptics on every kill (light) and on the final explosion (heavy, and long: two heavy taps on iPhone, a quarter-second hit on Android), synthesized-style pop and boom sounds. On Android, the round's haptics and the Yes play as media vibration, so they follow the phone's Media vibration setting; plain taps and ticks follow Touch feedback.
- Respect the OS reduce-motion setting: less shake, fewer particles, much dimmer full-screen flashes. For everyone, full-screen flashes (a bomb, the final zero) come at most about 3 a second, however fast bombs go; a bomb that clears the last zero is one flash.

## 8. Out of scope for v1
Accounts and cloud sync, leaderboards, IAP. Multiple goals, weekday schedules, game modes and themes are Win Zero Plus (section 9). Credit packs would grant into the credit wallet (section 5); the store answers (`docs/store/answers.md`) say rewards come only from check-ins (and Plus's free secret credit) and there are no digital purchases, so they'd change with it, as would the privacy policy for a payment provider. Keep the data model ready for a later FastAPI + Postgres sync backend (stable IDs, ISO dates, append-only history).

## 9. Win Zero Plus

Win Zero Plus is a second app built from this codebase as a build variant: its own name, bundle id (`com.e7systems.winzeroplus`), URL scheme (`winzeroplus`) and icon. It is **paid upfront**. Neither app has in-app purchases, ads or accounts, and both collect no data. Free Win Zero stays complete and free forever: one goal, every rule, the full arsenal and the Shooter.

Guardrails for both apps:
- Plus changes no rule. Each Plus goal follows sections 2–5 exactly; themes and modes never touch `rules.ts`, `resolve.ts` or `rewards.ts`.
- Nothing is for sale inside either app. The free app mentions Plus only in Settings › About, never on the Slipping, Reset, Shielded, Notice or support screens, and never with badges or nags.
- Plus is never on an older store version (`STORE_VERSION`) than the free app, so a move from the free app can always be read.

### Weekday schedules
- A goal checks in on the weekdays chosen (at least one): every day, weekdays, or any mix. Every day is the default, and the free app's only choice.
- A rest day has no window of its own, no history entry and no effect: nothing is gained or lost, and the streak counts Yes days as always.
- A window before a rest day still closes at midnight at the end of the next calendar day (section 2). With Monday to Friday, Friday can be answered until Saturday midnight, and its reminder still comes on Saturday asking about "yesterday".
- The 7 free missed days, and the slips after them, count check-in days. For a goal that isn't every day, the copy says "7 check-ins" rather than "a week".
- Changing the days takes effect from the next check-in day that hasn't opened yet. It never rewrites a settled day or closes an open window early.
- The history calendar shows rest days with a muted mark.

### Multiple goals
- Up to 3 goals. Each has its own wording, check-in and reminder times, days, streak, best run, bombs, shields, history, round and notices.
- **Shared arsenal.** Weapons (and mode power-ups) unlock from the best streak any goal has reached (`arsenalBest`, which never decreases). Adding or archiving a goal never takes a weapon away, and a Yes announces a weapon only when it raises that shared best.
- **One credit wallet**, as in section 5. Each one-time reward still pays once per install, so "Setting your first goal" pays once however many goals are added. The repeating ones (every 7 and every 30 Yeses in a row) pay for each goal's own runs.
- **Home's secret.** Three quick taps on Home's Game credits count give a free Game credit, as often as they're found, with a popup ("You found the secret stash.") and the Yes chime and haptic. The count looks and reads as in the free app, and its hint still opens on the "i". Settings › Games ends with a playful nudge toward it. It's free, like everything else in Plus: nothing is for sale.
- A bonus round's free bombs are the total banked across goals.
- **Archiving.** Removing a goal archives it: read-only history under Settings › Past goals, no reminders, and its slot is free. **Delete for good** is offered only from the archive.
- **Home** shows ready rounds, then open check-ins (the one that opened first, first), then when the other goals check in next. With one goal it looks exactly like the free app. With several, two tabs follow:
  - **Goals**, open first: a goal picker for the stats and history calendar, with **Add goal** beside its heading while there's room, and **Edit** beside the picked goal's name, which opens its goal screen.
  - **Game**: the credits and the arsenal.
- **Reminders.** Each goal has its own notifications with its own Yes / Not today. With "Goal in reminders" off and more than one goal, a reminder names the goal by its optional lock-screen name, or by its place ("your second goal"). At most 60 notifications are pending across all goals, filled in this order: each goal's next 2 windows, the first weekly nudge, the other reminders earliest first, then the remaining nudges. Weekly nudges are one stream that never names a goal. Every app open reschedules, as now.

### Game modes
Before each round not yet played (a day's or a bonus round), Plus asks **Pick your game**: one row per game, with its hint and the power-up it has now, the last pick marked. A tap plays the round in that game and saves the pick, as Settings › Games does; tapping outside or Android back plays the last pick. The Weapon credit question comes after it, in that game's words. A replay keeps its game. All modes are available from the start; modes earned later will join the picker.

| Mode | How it plays | Multi-hit / armored zeros | Power-ups (best streak 1 → 100) |
|---|---|---|---|
| **Shooter** | The free game (section 6). | As section 4 | The weapons (section 5) |
| **Catch** | Zeros fall and bounce; slide a cup to catch them. Every zero bounces back up high, off the floor or the cup, along its own arc; only the Magnet, Vacuum Beam and Black Hole draw zeros in. | Bounces up high until caught enough times / heavy, slow, worth ×V | Cup → Twin Cups → Net → Magnet → Chain Catch → Vacuum Beam → Black Hole |
| **Orbit** | The turret sits in the middle and aims all round. | As now / splits into smaller zeros that keep its value | The weapons |
| **Slice** | Zeros are tossed up in waves; swipe to slice. Missed ones are tossed again. | Each cut juggles it higher until it pops / big, slow zeros | Blade → Twin Blade → Wide Arc → Explosive Cut → Arcing Cut → Lingering Blade → Nova |
| **Breaker** | Zeros are bricks, with a paddle and ball. A dropped ball just respawns. | Brick hits / steel bricks worth ×V | 1 ball → 2 balls → Multi-ball → Fireball → Lightning Ball → Laser Paddle → Mega Ball |

Every mode uses `composeRound(n)`, can't be lost (no lives or timers; missed zeros come back), ends with the same celebration, fill and result sheet, and supports **Finish round** and bombs. Late in a round, gentle assists (homing, magnet) make sure the last zero can always be cleared. Catch has none: its zeros keep bouncing until they're caught. A Weapon credit lends a locked power-up in any mode.

### Themes and app icons
- Themes recolor the round (zeros, shots and the fill) and Home's drifting zeros. The rest of the app keeps the section 7 palette.
- Included: Classic (section 7), Neon Arcade, Mono CRT, Pastel. Earned by the shared best streak and never lost: Ember at 30, Aurora at 180, Gold Year at 365. An earned theme is announced on the result sheet like a weapon; nothing is ever offered for sale there.
- Settings › App icon offers the Plus icon and one per theme; an earned theme's icon unlocks with it.

### Moving from Win Zero to Plus
- Settings › About › **Move to Win Zero Plus**, shown once Plus is on the store. It moves goals, history, rewards, credits and preferences straight from one app to the other on the phone; nothing passes through a server.
- On iPhone the data goes through a folder only the two apps share (an App Group), and the link that opens Plus carries only an id. On Android it is handed to Plus by its package name, so no other app can receive it.
- Plus shows what will arrive and asks before importing. If it already has that goal, the user picks which copy to keep: by default the one answered more recently, since both apps settle missed days up to the same day on opening. With 3 goals already, it asks the user to archive one first. A move delivered twice adds its credits once, and the rewards either app already paid stay paid. A bonus round waiting to be played moves as the credits that paid for it.
- Once Plus confirms, Win Zero stops its reminders and Home says "Your goals now live in Win Zero Plus", with **Open Win Zero Plus** and **Keep using Win Zero here** (reminders come back; progress there hasn't changed since the move). If Plus never confirms, Win Zero asks after 10 minutes whether the move finished.
