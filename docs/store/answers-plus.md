# Store form answers: Win Zero Plus

Draft answers, reviewed October 24, 2026, for Win Zero Plus's privacy, safety and rating
questionnaires in App Store Connect and the Play Console. Win Zero's are in `answers.md`; most
answers are the same, because Plus is built from the same code. Source inspection supports local
progress storage and notifications, no app analytics or crash SDKs, and no in-app purchases (Plus
is paid for once through the store). Confirm the final binary and bundled SDK behavior before
submitting. See [review.md](review.md).

Re-check these if anything is added that sends data off the phone, or sells anything inside the
app.

---

## App Store Connect

### App Privacy ("nutrition label")
- **Data collection:** choose **"No, we do not collect data from this app."** The label then reads
  **Data Not Collected**.
- **Why:** goals and check-ins stay in local storage. Use Apple's collection definition and the
  release-artifact checks in `answers.md`; the store handles the upfront purchase. Separate
  backups, external website requests and voluntary support emails are covered by the policy.
- **The move from Win Zero** doesn't change this: it goes from one app to the other on the phone,
  through an App Group, and never reaches a server.

### Privacy manifest
The same as Win Zero's: `app.config.ts` gives Plus the `ios.privacyManifests` from `app.json`.
- No tracking, no tracking domains, no collected data types.
- The required-reason APIs that React Native and the Expo modules use.

Inspect the archive's combined manifests and upload validation before submission. Required reasons
must match actual API use. `app.json` alone does not verify the bundled SDKs.

### Export compliance
`ITSAppUsesNonExemptEncryption` is `false` (`ios.config.usesNonExemptEncryption` in `app.json`,
shared by both apps), so App Store Connect won't ask. If it does ask, answer: the app uses no
encryption beyond what the OS provides.

### Age rating and other declarations

Use the current questionnaire and proposed answers in `answers.md`, including **Health or Wellness
Topics**, **Guns or Other Weapons**, medical-device status and Accessibility Nutrition Labels.
Inspect all five games before confirming the content frequency. Extra games use abstract zeros,
with no human or animal injury, but still contain weapon names and cutting/shooting effects.

The hidden Game credit is deterministic, free and unlimited, disclosed in the review notes. It
is not a purchased random reward, wager or competition.

### In-app purchases
**None.** All features are included in the upfront purchase; some power-ups, themes and icons
still require streak progress. There is no additional paid unlock.

### App Review notes (paste into "Notes")
These explain the functional differences and disclose Home's secret. They do not guarantee
acceptance under Apple's guideline 4.3(a), which prohibits multiple Bundle IDs of the same app.
Google also has a repetitive-content policy. See `review.md` before committing to the release date.
```
Win Zero Plus needs no account. One upfront purchase includes all features, with no in-app purchases. All five games are playable from the start. Power-ups unlock with best streak; four themes are available immediately, with Ember at 30, Aurora at 180 and Gold Year at 365. Matching theme icons unlock at the same milestones.

How it relates to Win Zero: Win Zero (Apple ID 6823793298) is our free daily check-in app with a small arcade round. It is complete on its own: one goal, checked in every day, and one game. Win Zero Plus is a separate, paid edition with features Win Zero doesn't have:
- up to 3 goals, each with its own reminders, streak and history, and Past goals for archived ones
- check-in days for each goal (for example Mon, Wed, Fri), with rest days in between
- four more games besides the Shooter (Catch, Orbit, Slice and Breaker), picked before each round
- seven color themes, with matching alternate app icons
Win Zero offers an optional one-way move of a user's data into Plus (Win Zero: Settings > About). It happens on the device through an App Group the two apps share (group.com.e7systems.winzero); nothing goes to a server. Plus can be reviewed without Win Zero installed.

To see Plus quickly:
1. Open the app, enter any goal, and set the check-in time to a time that has already passed today. Today's check-in then opens right away on Home.
2. Tap "Yes, I did". "Pick your game" asks which game to play the round in. Shooter and Orbit: tap or hold to fire. Catch: slide to move the cup. Slice: swipe across the zeros. Breaker: slide to move the paddle. Clearing the last zero shows the celebration and the result sheet.
3. Home > "Add goal" adds a second goal, with its own check-in days.
4. Settings has Goals, Games, Themes and App icon. Choosing an app icon shows iOS's standard "You have changed the icon" alert.
5. Notifications (optional): allow them in Setup or Settings. Each goal's check-in arrives at its time as a notification with Yes / Not today buttons.

One playful extra, disclosed here: on Home, under the Game tab, tapping the Game credits count three times quickly gives a free Game credit, which plays a bonus round. It is free and unlimited, never sold, and hinted at the end of Settings > Games.

Goals and check-ins are stored locally. Notifications are scheduled locally; no app server is required. System backups are managed by the OS. Privacy and support links open our website in the browser.
```

---

## Google Play Console

### App setup
- **Create app:** name **Win Zero Plus**, App, **Paid**. Google Play never lets a free app become
  paid, so choose Paid here, and don't publish it as free on any track, even for a test.
- **Payments profile:** needed before a price can be set (Setup → Payments profile). It's shared by
  every app on the account.

### Data safety
- **Does your app collect or share any of the required user data types?** **No.**
  - Google doesn't count data that's only processed on the device and never sent off it.
  - The move is an explicit user action between two apps published by E7 Systems. Google also
    covers on-device transfers in its sharing definition; locality alone does not exempt them.
    Confirm first-party ownership and the user-initiated flow against the current guidance in
    `answers.md`.
- The listing then reads **"No data collected"** and **"No data shared with third parties"**.
- **Is all user data encrypted in transit?** Not applicable, since nothing is transmitted.
- **Do you provide a way for users to request that their data be deleted?** Data is on-device
  only. **Settings → Erase all data** deletes it.

### Health apps declaration

Use the scope and live-form review in `answers.md`, including the health disclaimer already in
`listing-plus.md`. Do not select an invented habit-tracking category or declare "no health
features" simply because no sensors are used. Save the actual selected options with the release.

### Content rating (IARC questionnaire)
- **Category:** **"All other app types"** (a habit tracker with mini-games), as for Win Zero.
- **Violence:** abstract shapes are caught, sliced, bounced off or destroyed. No humans, animals or
  realistic weapons, and no blood.
- **Drugs, alcohol, tobacco:** *references* only, as goals to stop. Answer the "references"
  question **Yes**, with that context, and the "depicts use" questions **No**.
- **The rest:**
  - User interaction or sharing: **No**.
  - Location sharing: **No**.
  - Digital purchases: **No**. The app is paid for on Google Play, and sells nothing inside.

### Target audience and content
- **Target age:** confirm the intended audience as in `answers.md`, using the actual age bands
  offered by Play. Keep both apps, the policy and the screenshots consistent.
- **Appeals to children:** **No**.

### Ads
**No**, the app contains no ads.

### App access
**All functionality is available without special access.** There's no login or extra purchase.
Earned power-ups/themes/icons still require progress; disclose this to reviewers as above.

### Permissions
Expected to match Win Zero; inspect the final merged manifest and Play permission report:
- notifications (asked at runtime, Android 13+)
- vibrate (haptics)
- receive boot completed (to keep scheduled reminders after a restart)
- internet
- modify audio settings (sound effects)

The storage and overlay permissions from the Expo template are removed (`blockedPermissions` in
`app.json`, shared by both apps). The alternate app icons add launcher entries (activity aliases),
not permissions. There's no exact-alarm permission, so reminders can arrive a few minutes late.
