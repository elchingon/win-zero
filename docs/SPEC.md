# Win Zero: Product & Game Spec

Version 0.4 · October 15, 2026 · Owner: e7sal

Win Zero is a daily habit app for iOS and Android. The user sets one daily goal (for example "Stop drinking" or "Exercise more"). Every evening the app asks whether they did it. Each "yes" adds a zero to a shooting round. The streak is the number of zeros on screen.

The playable web prototype at `docs/prototype/win-zero.html` sets the **look, feel, and game juice**: palette, fonts, explosions, the final-zero celebration, and the screen filling with zeros. Open it in a browser. **Where the prototype's rules differ from this spec, this spec wins.** The prototype predates sections 3–6.

---

## 1. Core loop

1. User sets a goal and a check-in time (default 8:00 PM local).
2. At check-in time, a notification asks: *Did you stick to "<goal>" today?* with **Yes** and **Not today** buttons.
3. **Yes** from the notification opens the app on Home, with a shooting round of `streak` zeros ready to play whenever the user likes. **Yes** on Home's check-in card starts the round straight away.
4. Shooting the last zero triggers the big celebration explosion. Then the screen fills with `streak` giant zeros, a line of encouragement pops up with a horn fanfare, and a result sheet appears.
5. Rewards (weapons, bombs, shields) are granted on the result sheet.

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

Hold to fire at about 6 shots/sec.

**Bombs:** +1 every time `streak` hits a multiple of 5. Banked and never lost. Using one deals 8 dmg to every zero within 42% of the screen's longest side.

**Streak shields:** +1 every time `streak` hits a multiple of 7. Maximum 3 banked. Consumed per section 3.

## 6. Screens

- **Onboarding / Setup:** goal (free text plus suggestion chips), check-in time, reminder time (any time of day), notification permission request with a short explanation first. Set up after the check-in time, today counts: today's check-in is open straight away, and both Setup's last step and Home (until the first answer) say so plainly.
- **Home:** goal, current streak, best run (with the dates it ran), Yes days in all and this month, bombs, shields; pending check-in card (same Yes / Not today as the notification); arsenal list with next-unlock progress; history calendar (yes / no / shielded / missed). While reminders are off (never turned on, or off in system settings), a card offers to turn them on; its "Not now" hides it for a week.
- **Play:** full-screen Skia canvas, HUD (value left, day, weapon switch, bomb button, sound toggle), turret at bottom center.
- **Encouragement:** when the fill lands after a real round or a replay, a popup over the zeros shows one line of encouragement, picked at random with no repeat back to back (`src/ui/copy/cheers.ts`). A short horn fanfare and a light haptic play as it appears, following the sound and haptics settings. **Got it**, tapping outside, Escape or Android back dismisses it, and the result sheet rises. None in practice.
- **Result sheet:** over the filled screen, showing day, "N zeros down", rewards earned, next unlock, and buttons for Back to base and Replay (replay has no streak effect). A round that earned something (a weapon, a bomb or a shield) offers **Share this milestone**: plain text through the phone's share sheet, for example "Day 30 on Win Zero: 30 zeros down. I unlocked the Chain Zapper." It never includes the goal's wording.
- **Reset / Shielded / Slipping:** supportive copy, never shaming. Slipping covers any slip that cost a zero, from a Not today or from missed days found on opening: "You've lost a zero. Check in to stop the slide." The final shows Reset (encouraging) or Shielded. After a Not today, the screen offers **Undo Not today** for 10 seconds (30 with a screen reader on), in case it was a mis-tap: the goal and round go back to just before the answer, as long as that check-in is still open.
- **Settings:** edit goal and times, sound/haptics, re-engagement toggle, erase data, support link, an **About** section (privacy policy, support page, support email, app version), and **How it works**: the rules in plain words (the daily question, the slide and the final, a fresh run, missed days, banked rewards), with numbers taken from the engine.

**Support link:** goals like quitting drinking are health-related. Settings should include a "Need support?" row, and the Slipping and Reset screens link to it too. In the US, list the SAMHSA National Helpline, 1-800-662-4357 (free, confidential, 24/7). On a device that can't place calls (an iPad, say), tapping it shows the number to call from any phone, and SAMHSA's text option, instead of failing silently. Localize later.

## 7. Visual identity (from the prototype)

- Palette: ink `#0D1130`, ink-2 `#151A44`, panel `#1B2150`, panel-2 `#252C68`, line `#353D80`, fg `#F5F0E6`, muted `#AAB0D8`, amber `#FFB52E` (primary), amber-deep `#B9770A`, flare `#FF4F6D` (danger/bombs), teal `#3FDCCB` (weapons/success).
- Type: **Bungee** (display, zeros, buttons), **Barlow** (body), **JetBrains Mono** (labels, HUD numbers).
- Dark-only app. Zeros are oval rings in a rotating amber / flare / teal / fg palette with glow.
- Game feel: screen shake, hit flash, particle bursts, shockwave rings, haptics on every kill (light) and on the final explosion (heavy), synthesized-style pop and boom sounds.
- Respect the OS reduce-motion setting: less shake, fewer particles.

## 8. Out of scope for v1
Accounts and cloud sync, multiple goals, leaderboards, IAP. Keep the data model ready for a later FastAPI + Postgres sync backend (stable IDs, ISO dates, append-only history).
