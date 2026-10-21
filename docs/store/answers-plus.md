# Store form answers: Win Zero Plus

Answers for Win Zero Plus's privacy, safety and rating questionnaires in App Store Connect and the
Play Console. Win Zero's are in `answers.md`; most answers are the same, because Plus is built from
the same code. The facts below are true of the code on this branch: no network calls of our own, no
analytics or crash SDKs, local notifications only, data in on-device storage, and no in-app
purchases (Plus is paid for once, through the store).

Re-check these if anything is added that sends data off the phone, or sells anything inside the
app.

---

## App Store Connect

### App Privacy ("nutrition label")
- **Data collection:** choose **"No, we do not collect data from this app."** The label then reads
  **Data Not Collected**.
- **Why:** Apple counts data as collected only when it leaves the device and is stored where you
  or a third party can reach it. Win Zero Plus never sends anything off the phone. The purchase is
  Apple's, not the app's, and isn't data the app collects.
- **The move from Win Zero** doesn't change this: it goes from one app to the other on the phone,
  through an App Group, and never reaches a server.

### Privacy manifest
The same as Win Zero's: `app.config.ts` gives Plus the `ios.privacyManifests` from `app.json`.
- No tracking, no tracking domains, no collected data types.
- The required-reason APIs that React Native and the Expo modules use.

If Apple emails about a missing reason after an upload, add it in `app.json`, which covers both
apps.

### Export compliance
`ITSAppUsesNonExemptEncryption` is `false` (`ios.config.usesNonExemptEncryption` in `app.json`,
shared by both apps), so App Store Connect won't ask. If it does ask, answer: the app uses no
encryption beyond what the OS provides.

### Age rating
Answer as for Win Zero (`answers.md`). The four extra games are the same abstract zeros caught,
sliced, bounced and broken, with no characters and no injury.

- **Alcohol, tobacco or drug use or references:** **Infrequent / Mild**, for the goal suggestions
  ("Stop drinking", "Quit vaping") and any goal typed in.
- **Medical or treatment information:** **None**. The support line link describes no treatment.
- **Cartoon or fantasy violence:** **None** (or **Infrequent / Mild** to be cautious).
- **The rest:**
  - Unrestricted web access: **No**.
  - User-generated content shared with others: **No**. Goals never leave the phone.
  - Gambling, contests and loot boxes: **No**. Rewards come only from check-ins, plus a free
    hidden credit on Home (see the review notes). Nothing is random, and nothing is sold.

### In-app purchases
**None.** Every feature comes with the app.

### App Review notes (paste into "Notes")
These are the main defense against guideline 4.3(a) ("multiple Bundle IDs of the same app"): they
say plainly what Plus does that Win Zero doesn't, and how the two relate. They also disclose Home's
secret, since guideline 2.3.1 rules out hidden features App Review doesn't know about.
```
Win Zero Plus needs no account, and the purchase unlocks everything: there are no in-app purchases.

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

All data stays on the device. Notifications are scheduled locally; there is no server.
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
  - The move from Win Zero is handed from app to app on the phone, by package name.
- The listing then reads **"No data collected"** and **"No data shared with third parties"**.
- **Is all user data encrypted in transit?** Not applicable, since nothing is transmitted.
- **Do you provide a way for users to request that their data be deleted?** Data is on-device
  only. **Settings → Erase all data** deletes it.

### Health apps declaration
As for Win Zero: choose the option closest to **habit tracking / behavior change**, or the general
wellness one. Win Zero Plus doesn't measure the body, give medical advice, or connect to Health
Connect. Don't select anything about medical devices, treatment, or clinical use.

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
- **Target age:** 18+, or 13+ if you want, as for Win Zero. Choosing ages under 13 brings in the
  Families policies.
- **Appeals to children:** **No**.

### Ads
**No**, the app contains no ads.

### App access
**All functionality is available without special access.** There's no login, and the purchase
unlocks everything.

### Permissions
The same as Win Zero's: nothing at install, and it declares
- notifications (asked at runtime, Android 13+)
- vibrate (haptics)
- receive boot completed (to keep scheduled reminders after a restart)
- internet
- modify audio settings (sound effects)

The storage and overlay permissions from the Expo template are removed (`blockedPermissions` in
`app.json`, shared by both apps). The alternate app icons add launcher entries (activity aliases),
not permissions. There's no exact-alarm permission, so reminders can arrive a few minutes late.
