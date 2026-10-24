# Audience and tag plan

Reviewed October 24, 2026. Start with people who want **habit consistency with a playful reward**.
The best-fit audiences are routine builders, people working toward personal goals, and people
who find an arcade reward more inviting than a checklist. Plus also suits people tracking up to
three habits on different weekdays.

These are relevance-based launch recommendations. No search-volume, acquisition or tag-level
performance data was available. The live console labels still need confirmation; nothing here
has been applied to either store.

## Google Play: recommended selections

Use **App → Health & Fitness**, as in the listing drafts. Search for these tag labels in
**Grow users → Store presence → Store settings → Manage tags** for both apps:

| Selection priority | Tag to look for | Audience and product evidence |
| --- | --- | --- |
| 1 | **Self-help** | People working on personal goals; setup, daily check-ins and supportive recovery after a slip are central. |
| 2 | **Productivity** | Routine builders who want reminders, a record of check-ins and visible progress. Plus adds weekday schedules. |
| 3 | **Lifestyle** | Everyday goals such as reading, walking and stretching, rather than a specialized workout or medical program. |
| 4 | **Health & fitness** | People using self-reported goals for healthier habits; consistent with the chosen category and existing examples. |
| 5 | **Entertainment** | People attracted to an arcade reward: one recurring game in Win Zero and five in Plus. Use only if the live tag description covers this experience. |

The first four are the core shortlist. Entertainment is the weaker fifth candidate; leave that
slot empty if its live definition does not fit. The priority above is for choosing a limited set,
not a claim that Google weights the first tag more heavily. Both editions can use the same core
set because they serve the same underlying need.

These labels appear in a [published April 2024 tag catalog](https://www.rechor.com/googleplayconsoleappcategorytags/),
which is historical corroboration, not proof of the current picker. Google's public help does not
supply a complete current catalog. Check availability and definitions before saving. **Habit
tracker**, **Motivation** and **Goal setting** are useful audience concepts, but the earlier listing
suggestion did not verify them as selectable Play tags. If the current picker offers a precise
habit-tracking label, prefer it over Entertainment, then over a less specific broad label.

Google permits up to five tags, requires an obvious connection to the listing/initial experience,
and recommends changing tags when functionality or content changes significantly. Keep tags
stable while testing screenshot or short-description variants. [Google tag guidance](https://support.google.com/googleplay/android-developer/answer/9859673?hl=en).

## Apple: review generated tags

Apple generates and curates tags from metadata; the console lets you deselect assigned tags.
This is separate from the editable keyword field. Apple's current help describes tags as US-only,
based on en_US metadata. [Apple tag guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-tags).

In **App Information → App Store Tags → Edit**, retain assigned tags that accurately express:

- **Core intent:** habit tracking, routines, goal tracking and personal motivation.
- **Distinctive experience:** arcade play and earned rewards, when the generated label describes
  the actual experience.
- **Plus benefits:** multiple goals and flexible check-in schedules, when represented by an
  assigned tag.

These are concepts to evaluate, not a promised list of Apple tag names or tags you can type in.
The current descriptions and subtitles already explain them. Do not add a keyword dump to the
customer description to try to force a tag.

## Editable Apple keywords

Use the exact keyword blocks in `listing.md` and `listing-plus.md`; both fit the 100-character
limit and use ASCII. The free title **Win Zero Goal Tracker Game** and subtitle **Daily habits. Arcade rewards.**
cover goal/tracker/game and daily habit play. Plus's subtitle covers habit/tracker/goals/games.
The hidden fields add other relevant ways people describe their intent.

| Audience intent | Free keyword coverage | Plus keyword coverage |
| --- | --- | --- |
| Daily consistency | streak, routine, reminder, check-in; daily is in the subtitle | streak, routine, reminder, daily |
| Personal goals | motivation, discipline, self care, progress; goal is in the title | motivation, discipline, self care |
| Playful reinforcement | Game in the title; arcade/rewards in the subtitle | arcade |
| Local use without an account | offline | offline |
| Leaving an unwanted habit | quit | Use the main habit/routine terms; the product supports user-defined goals. |
| Schedules and history | calendar describes check-in history; Free checks in daily | schedule, calendar |

These are search hypotheses, not verified popular terms or an attribution model. The keywords do
not repeat title/subtitle words; they also avoid competitor brands and unsupported treatment
claims. [Apple keyword guidance](https://developer.apple.com/app-store/product-page/).

## Keep audience expectations accurate

Do not choose tags for workouts, sleep measurement, meditation instruction or medical treatment
just because a user can type those goals. Do not choose Privacy & security because progress is
local, or Theme because Plus recolors its own UI: those imply different primary products. Keep
standalone game genres out of the app's tags unless the actual app picker offers an applicable
label. Accessibility tags require the device QA already listed in `docs/RELEASE.md`.

Before submission, save each app's actual selected Play labels and assigned Apple tags with the
release notes. If the current picker differs from this shortlist, use its definitions and the
same relevance priorities. Review discovery and conversion by app/platform after launch; do not
claim a tag drove an install unless the reporting supports that attribution.
