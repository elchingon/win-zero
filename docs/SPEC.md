# Win Zero: Product & Game Spec

Version 0.2 · October 13, 2026 · Owner: e7sal

Win Zero is a daily habit app for iOS and Android. The user sets one daily goal (for example "Stop drinking" or "Exercise more"). Every evening the app asks whether they did it. Each "yes" adds a zero to a shooting round. The streak is the number of zeros on screen.

The playable web prototype at `docs/prototype/win-zero.html` sets the **look, feel, and game juice**: palette, fonts, explosions, the final-zero celebration, and the screen filling with zeros. Open it in a browser. **Where the prototype's rules differ from this spec, this spec wins.** The prototype predates sections 3–6.

---

## 1. Core loop

1. User sets a goal and a check-in time (default 8:00 PM local).
2. At check-in time, a notification asks: *Did you stick to "<goal>" today?* with **Yes** and **Not today** buttons.
3. **Yes** opens the app into a shooting round with `streak` zeros.
4. Shooting the last zero triggers the big celebration explosion. Then the screen fills with `streak` giant zeros, and a result sheet appears.
5. Rewards (weapons, bombs, shields) are granted on the result sheet.

## 2. Check-in windows

Each goal day `D` has one answer window:

- **Opens:** check-in time on day `D` (first notification).
- **Second reminder:** morning reminder time on day `D+1` (default 9:00 AM). It asks *"Did you stick to '<goal>' yesterday?"*.
- **Closes:** check-in time on day `D+1`, when day `D+1`'s window opens.

Only one window can be pending at a time. If a window closes unanswered, day `D` is **missed** (see section 3).

Notifications are **local** (scheduled on device; no push server needed for v1):

- While a day is unanswered, send 2 reminders per day (evening check-in + morning reminder).
- Pre-schedule the next 7 days of reminders. On every check-in or app open, cancel and reschedule.
- Reminders stop once the streak resets from 7 consecutive missed days (section 3). After that, send one gentle re-engagement notification per week (setting, default on).

## 3. Streak rules (the rules engine)

State fields: `streak`, `bestStreak`, `shields`, `bombs`, `consecutiveMissed`, `history[]`.

| Event | Effect |
|---|---|
| **Yes** for day D | `streak += 1`; `bestStreak = max(bestStreak, streak)`; `consecutiveMissed = 0`; grant rewards (section 5); play a round with `streak` zeros. |
| **Not today** for day D | If `shields > 0`: consume 1 shield; streak unchanged; history records `shielded`; show the shield-absorb animation (no round). Otherwise `streak = 0`, so the next Yes plays 1 zero. `consecutiveMissed = 0`. |
| **Missed** day D (window closed unanswered) | `consecutiveMissed += 1`; `streak = max(0, streak - 1)` (lose one zero per missed day). History records `missed`. |
| **7th consecutive missed day** | Full reset: `streak = 0`. Reminders stop (section 2). |

Notes:
- `bestStreak` never decreases. It drives weapon unlocks.
- Missed days are resolved lazily. On app open, on notification response, or in a background task, run `resolve(state, now)` to walk every closed window since the last resolution. It must be idempotent and handle the app being closed for weeks.
- All date math uses the user's local timezone and must survive DST changes and travel. Store the timezone with each history entry.

### Open questions (assumptions are in place; confirm or change)
1. Does a shield also protect a **missed** day, or only an honest "Not today"? *Assumed: only "Not today".*
2. Is a shield used automatically, or does the app ask "Use a shield?" *Assumed: automatic, with an animation.*
3. Does a missed day after a "Not today" reset have any effect at `streak = 0`? *Assumed: it still counts toward the 7-day reminder cutoff.*

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

- **Onboarding / Setup:** goal (free text plus suggestion chips), check-in time, morning reminder time, notification permission request with a short explanation first.
- **Home:** goal, current streak, best run, bombs, shields; pending check-in card (same Yes / Not today as the notification); arsenal list with next-unlock progress; history calendar (yes / no / shielded / missed).
- **Play:** full-screen Skia canvas, HUD (value left, day, weapon switch, bomb button, sound toggle), turret at bottom center.
- **Result sheet:** over the filled screen, showing day, "N zeros down", rewards earned, next unlock, and buttons for Back to base and Replay (replay has no streak effect).
- **Reset / Shielded / Slipping:** supportive copy, never shaming. Slipping covers missed days: "You've lost a zero. Check in to stop the slide."
- **Settings:** edit goal and times, sound/haptics, re-engagement toggle, erase data, support link.

**Support link:** goals like quitting drinking are health-related. Settings should include a "Need support?" row. In the US, list the SAMHSA National Helpline, 1-800-662-4357 (free, confidential, 24/7). Localize later.

## 7. Visual identity (from the prototype)

- Palette: ink `#0D1130`, ink-2 `#151A44`, panel `#1B2150`, panel-2 `#252C68`, line `#353D80`, fg `#F5F0E6`, muted `#AAB0D8`, amber `#FFB52E` (primary), amber-deep `#B9770A`, flare `#FF4F6D` (danger/bombs), teal `#3FDCCB` (weapons/success).
- Type: **Bungee** (display, zeros, buttons), **Barlow** (body), **JetBrains Mono** (labels, HUD numbers).
- Dark-only app. Zeros are oval rings in a rotating amber / flare / teal / fg palette with glow.
- Game feel: screen shake, hit flash, particle bursts, shockwave rings, haptics on every kill (light) and on the final explosion (heavy), synthesized-style pop and boom sounds.
- Respect the OS reduce-motion setting: less shake, fewer particles.

## 8. Out of scope for v1
Accounts and cloud sync, multiple goals, leaderboards, IAP. Keep the data model ready for a later FastAPI + Postgres sync backend (stable IDs, ISO dates, append-only history).
