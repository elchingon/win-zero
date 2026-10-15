> **Outdated rules (noted October 14, 2026).** This is the original kickoff prompt, kept for history. Its streak and reminder rules are the v0.2 rules, which SPEC v0.3 replaced:
> - Missed days 1–7 in a row are grace: nothing is lost.
> - Not today, and each missed day from the 8th in a row on, is a slip that costs one zero.
> - The 7th slip since the last Yes is the final: a shield absorbs it, otherwise the streak resets.
> - Reminders are scheduled up to 14 windows ahead, and stop once a run of missed days resets the streak.
>
> Where this prompt and `docs/SPEC.md` differ, the spec wins. The out-of-date phrases below are marked *(v0.2, outdated)*.

Read CLAUDE.md, docs/SPEC.md, and docs/prototype/win-zero.html in full before doing anything else. The prototype is the reference for look and game feel; the spec is the source of truth for rules wherever they differ.

We're building Win Zero as an Expo + TypeScript app for iOS and Android, using the stack in CLAUDE.md. Work in these phases, and stop after each phase so I can review and test on a device:

Phase 1 — Foundation + rules engine
- Configure the Expo project already in this folder: TypeScript strict, expo-router, expo-dev-client, the src/ layout from CLAUDE.md, theme tokens and fonts from SPEC section 7, jest.
- Implement src/engine as pure functions: check-in windows (SPEC 2), yes / not-today / missed / 7-missed reset *(v0.2, outdated: see SPEC §3)* and shields (SPEC 3), resolve(state, now) for catching up on closed windows, composeRound(n) including energy-bar zeros for days 1–7 and armored zeros above 60 (SPEC 4), weapon unlocks by bestStreak, bombs, and shields (SPEC 5).
- Write thorough unit tests: every row of the SPEC 3 table, losing one zero per missed day, the 7th-missed-day reset *(v0.2, outdated: see SPEC §3)*, shields capped at 3, weapons staying unlocked after a reset, composeRound for n = 1, 2, 7, 8, 60, 61, 250, 1000, a weeks-long absence, and a DST transition.

Phase 2 — Screens + state
- zustand store wrapping the engine with persistence. Setup, Home (check-in card, stats incl. shields, arsenal, history calendar), Result, Reset/Shielded/Slipping, and Settings screens, styled like the prototype.

Phase 3 — Game
- Skia + Reanimated play screen ported from the prototype: moving oval zeros, turret, hold-to-fire, all 7 weapons with the SPEC 5 damage model, energy bars, armored zeros, bombs, particles, shockwaves, screen shake, haptics, sound, the final-zero celebration, and the screen-filling zeros. Must hold 60 fps on a mid-range Android phone.

Phase 4 — Notifications
- Local notifications per SPEC 2: evening check-in plus morning reminder while unanswered, Yes / Not today action buttons, 7-day rolling schedule *(outdated: up to 14 windows ahead, SPEC §2)* rebuilt on every check-in and app open, stop after the 7-missed reset *(v0.2, outdated: they stop when a run of missed days resets the streak, SPEC §2–3)*, weekly re-engagement nudge. Tapping Yes opens straight into the round *(v0.3, outdated: Yes from a notification opens Home with the round ready, SPEC §1)*.

Before writing code, list any SPEC open questions or ambiguities you find, state the assumption you'll use for each, and give me a short plan for Phase 1. Then build Phase 1.
