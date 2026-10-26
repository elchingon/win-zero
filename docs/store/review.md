# Store release review

Reviewed October 24, 2026 against the repository, the public support/privacy pages, and current
Apple and Google guidance. This reviews the drafts; it does not certify a submitted binary or
completed console forms. No store listing or website was published during this review.

## Verdict

The product has a clear hook: **a habit check-in that becomes an arcade round**, with supportive
streak rules and no ads or subscription. Keep that hook consistent across search metadata, the
first screenshots, onboarding and the actual experience.

The revised copy is a stronger launch draft. **Do not submit yet:** the live pages still omit
Plus, final screenshot exports and device QA are outstanding, and the pending-transfer deletion
path below needs a fix and verification. Separate Free/Plus apps also carry an unresolved review
risk. Good metadata can improve relevance and conversion; it cannot guarantee a ranking.

## Highest-priority findings

| Priority | Finding and evidence | Required next step |
| --- | --- | --- |
| Blocker | **Erasing during an unfinished iOS move can leave a copy behind.** `src/transfer/transport.ios.ts` writes `move-<id>.wz1` in the shared App Group. `src/app/settings.tsx` calls `store.erase()`, and `src/store/createAppStore.ts` clears persisted state, including the move ID, without calling `transport.discard(id)`. No erase cleanup was found in the transfer/lifecycle paths. | Before claiming complete local deletion, reproduce on a test device: start a move, leave the import unaccepted, erase Win Zero, then verify the shared snapshot is gone and the old delivery cannot import erased progress. Add cleanup and a regression check. Reconcile an already-open import too. This review changes docs only. |
| Blocker | **Public pages are behind the drafts.** Both `https://winzero.app/privacy` and `/support` returned HTTP 200 without a redirect on October 24. The live policy says October 15, 2026; neither page mentions Win Zero Plus. | Deploy the updated policy/support pages before submitting Plus, then recheck the visible content, mobile layout and in-app links. Confirm the proposed support-email handling matches actual practice. |
| Blocker | **Plus's real Apple ID is still missing from the handoff.** `answers.md` has `<PLUS_APPLE_ID>` and `eas.json` has no `submit.production-plus.ios.ascAppId`. The checked-in production build profile does not set Plus store URLs; production-environment variables or local `.env` may supply them separately. | Fill the real ID into review notes and the selected submission path. Check the resolved release environment and installed binary: Win Zero must offer Move only when Plus's real page is live. Do not use `https://winzero.app/` as an App Store stand-in. |
| Required | **Separate editions can be treated as duplicate/repetitive apps.** Both share the main habit engine and UI; Plus adds real goals/scheduling/game differences. Naming, icons and price do not settle the policy question. | Keep both products fully disclosed in review notes and demonstrate the functional differences. Allow review time before announcing a date. If either store requires consolidation, a single-app paid unlock is a product/billing change, not a copy fix. |
| Required | **The screenshot files are still a production task.** `docs/store/` contains plans, not final upload sets. The prior Android 1080 × 2400 instruction violates Play's 2:1 maximum dimension ratio. Practice-mode HUDs contain a frame meter. | Follow the revised capture plans: native UI, correct exports, no debug/performance overlays, and clear context for earned features. Visually check every final image on a phone. |
| Required | **Questionnaire answers are draft guidance.** Health, weapon references, audience bands and accessibility labels require deliberate answers against the current forms and release builds. | Complete both apps' forms, save the answers with the release, and finish the applicable device QA rows in `docs/RELEASE.md`. |

Policy basis for separate editions: [Apple guideline 4.3](https://developer.apple.com/app-store/review/guidelines/#spam)
and [Google repetitive-content policy](https://support.google.com/googleplay/android-developer/answer/18258653?hl=en).
This is a review risk, not a prediction that either app will be rejected.

## Accuracy changes made

- Replaced the claim that Not today never costs the whole run. Ordinary losses can reach zero;
  each seventh slip can reset the remaining streak unless a shield intervenes. Yes and shield
  protection clear the slip count (`src/engine/rules.ts`).
- Corrected bomb/shield rewards to **new milestones within a run**, rather than consecutive days
  or repeatedly reclaiming the same milestone (`src/engine/rewards.ts`).
- Clarified that the free app starts with one weapon and unlocks six more. Bonus-round and
  weapon/power-up credits are earned, not bought (`src/engine/weapons.ts`, `creditRewards.ts`).
- Clarified Plus's upfront purchase: all five games are playable immediately, while some
  power-ups, themes and matching icons require progress (`src/engine/modes.ts`, `themes.ts`).
- Replaced absolute privacy slogans with local-progress claims. The policy now explains system
  backups, support emails and external website visits. No app analytics/ads/crash SDK was found
  in the inspected source/dependencies; final binary behavior still needs confirmation.
- Added the Play health disclaimer for the existing Health & Fitness/behavior-change positioning,
  and updated the form guidance for wellness and weapon references. Accessibility claims remain
  conditional on device QA; no new certification is implied.
- Aligned the release run sheet's Plus version with `app.config.ts` (**1.2.0**), and corrected the
  first-Android-release rollout, managed-publishing prerequisites and Google fee-tier enrollment
  instructions.

## Discovery and conversion decisions

| Surface | Launch draft | Reason |
| --- | --- | --- |
| Apple, free name | Win Zero Goal Tracker Game | User-selected title: brand, goal tracking and the game reward, within 30 characters. |
| Apple, free subtitle | Daily habits. Arcade rewards. | Adds daily-habit context and the reward loop without repeating the title. |
| Apple, Plus subtitle | Habit tracker, goals & games | Gives a new buyer product context without needing the free app's listing. |
| Play, free name | Win Zero Goal Tracker Game | Uses the same user-selected store title as Apple; 26 characters. |
| Play, Plus name | Win Zero Plus: Habit Tracker | Keeps the category clear; the short description explains three habits and five games. |
| Description opening | Habit/check-in/arcade loop; Plus begins with its own benefits | Explains what a first-time visitor gets before discussing the relationship between editions. |
| First screenshots | Free: question → game → progression. Plus: multiple goals → schedule → game. | Shows what to do, why it is interesting and why Plus differs. |

These are editorial hypotheses, **not measured search-volume or conversion results**. No keyword
tool, acquisition history or competitor-volume dataset was available. Retain the brand names;
there is no need to change native app identifiers or home-screen names for these metadata edits.

Apple explicitly uses title, subtitle, keyword and category relevance among its search factors.
Its promotional text is for conversion/news, not search indexing. Keep keywords relevant and avoid
repeating title/subtitle words. The revised fields do not position Win Zero as a dedicated sobriety
timer or treatment service; users can still choose those goals. See [Apple search](https://developer.apple.com/app-store/search/)
and [product-page guidance](https://developer.apple.com/app-store/product-page/).

Keep Health & Fitness only if it best describes the intended product; do not change category just
to avoid a declaration. Use the ranked shortlist and Apple tag review in [tags.md](tags.md), confirming the live Play
labels rather than assuming “Habit tracker” exists.
Start with accurate English copy and platform-specific UI screenshots. Add other languages only
when the listing, UI expectations and support experience can serve that audience.

## Asset review

- Both Play feature graphics are **1024 × 500**, both Play icons are **512 × 512**, and both Apple
  store icons are **1024 × 1024** without an alpha channel. These dimensions are correct.
- The feature graphics were visually inspected. They are readable brand cards, but neither
  explains habit tracking or the arcade loop. Plus prominently repeats its icon. A useful later
  experiment would show actual habit/game UI with a short product benefit while retaining the
  brand. This is an opportunity, not an upload blocker.
- Follow the capture docs for a complete screenshot set. Include at least four 1080 × 1920 app
  images for Play's screenshot recommendation formats. Export within each platform's accepted
  sizes; avoid stretched UI and claims that earned themes are available immediately.

Sources: [Google asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB),
[Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

## Submission checklist

- [ ] Resolve and verify pending iOS transfer deletion; check the policy and Erase UI against it.
- [ ] Publish the revised support/privacy pages and verify both apps' in-app links.
- [ ] Confirm the real developer identity/contact details, Plus price/countries and intended age
  bands. Complete trader verification if distributing in the EU; see [Apple's DSA requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements).
- [ ] Complete Health apps, privacy/data safety, medical-device status where requested, ratings,
  app access and ads forms using `answers.md` / `answers-plus.md`. Confirm bundled SDK behavior.
- [ ] Confirm accessibility claims and any Accessibility Nutrition Labels against all common tasks.
- [ ] Set the real Plus Apple ID and store URLs, remove placeholders from pasted fields, and
  confirm version/build identifiers match the tested uploads.
- [ ] Capture and inspect six to eight platform-specific screenshots per app; upload icons and
  feature graphics. Check all limited text fields in the live consoles.
- [ ] Finish the release-device QA, including notification actions, offline use, time changes,
  move/cancel/conflict paths, archive/delete, all games, and icon switching.
- [ ] Finish account-specific production-access/testing requirements, payment agreements, tax,
  banking and fee-tier enrollment. Internal testing alone may not grant Play production access.
- [ ] Submit complete review notes with the hidden credit and earned content disclosed. Plus can
  be reviewed standalone; Win Zero's Move build waits for Plus's working store pages.

## After launch

Use the stores' built-in reporting first. Keep each app/platform/country/traffic source separate,
record the release and metadata dates, and compare the same acquisition metric and denominator
between periods. Watch discovery traffic, listing conversion, purchases for Plus, ratings/review
text, and crash/ANR reports. Store reports cannot reveal which privately stored goals people use.

Let the first complete week establish a baseline. Test one creative change at a time, starting
with the first screenshot or short description. Use the console's experiment confidence and sample
requirements; a small launch audience or a few days of movement is not a reliable winner. Apple's
product-page optimization tests creative assets; use Play experiments for eligible text/assets.
Sources: [Apple product-page optimization](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/),
[Google store listing experiments](https://support.google.com/googleplay/android-developer/answer/12053285?hl=en).

Reply to substantive reviews and fix repeated friction before expanding promotion. Do not buy,
incentivize or gate positive ratings. Ranking depends on relevance and user response as well as
listing quality; the launch goal is to reach the right people with a promise the app keeps.
