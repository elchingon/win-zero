# Store form answers

Draft answers for the privacy, safety and rating questionnaires in App Store Connect and the Play
Console, reviewed October 24, 2026. Source inspection supports local progress storage, local
notifications, and no app analytics, advertising or crash-reporting SDKs. Final answers must match
the submitted binary, its bundled SDKs and the current console questions. See [review.md](review.md).

Re-check these if anything is added that sends data off the phone.

---

## App Store Connect

### App Privacy ("nutrition label")
- **Data collection:** choose **"No, we do not collect data from this app."** The label then reads
  **Data Not Collected**.
- **Why:** Goals and check-ins are processed locally. Apple's collection definition concerns
  off-device transmission accessible beyond servicing a request in real time. Check bundled SDKs
  and release traffic before confirming; an `INTERNET` permission alone proves neither collection
  nor its absence.
- **Separate services:** system backups, store purchases, the external support/privacy website and
  an email the user chooses to send have their own handling, described in the privacy policy.
  Reassess the label if support becomes an in-app form or automatically attaches diagnostics.

Source: [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/).

### Privacy manifest
Already set in `app.json` (`ios.privacyManifests`):
- No tracking, no tracking domains, no collected data types.
- The required-reason APIs that React Native and the Expo modules use.

Inspect the archive's combined manifests and upload validation results before submission. A
required reason must match actual API use; a list in `app.json` alone does not establish compliance.

### Export compliance
`ITSAppUsesNonExemptEncryption` is `false` in `app.json`, so App Store Connect won't ask. If it
does ask, answer: the app uses no encryption beyond what the OS provides.

### Age rating

Use the current questionnaire, including **Health or Wellness Topics** and **Guns or Other
Weapons**. It produces the rating; do not target a particular rating by changing answers.

- **Alcohol, Tobacco, or Drug Use or References:** proposed **Infrequent / Mild**, for goal
  suggestions such as "Stop drinking" and "Quit vaping". No use is depicted. Private user-entered
  text is not content supplied by the developer.
- **Medical or Treatment Information:** proposed **None**. No medical advice or treatment guidance.
- **Health or Wellness Topics:** proposed **Yes**, for lifestyle/health goal suggestions and the
  wellness positioning. This is separate from medical advice.
- **Guns or Other Weapons:** **present**. Answer the frequency question from the actual recurring
  gameplay: weapon references are core to the Shooter, including Rocket and Zero Nuke. Abstract
  targets do not remove those references.
- **Cartoon or Fantasy Violence:** proposed **None** for conflict/harm, because targets are abstract
  zeros without people, animals or injury. Inspect the effects against Apple's examples before
  confirming, and disclose weapon references separately.
- **Other capabilities:** no unrestricted in-app web access, broadly distributed user content,
  social feed, messaging, ads, parental controls or age assurance.
- **Chance-based activities:** no gambling, simulated gambling, contests or loot boxes. Rewards
  follow fixed check-in rules, plus Plus's free hidden credit; there is no wagering or purchased
  random reward.

Source: [Apple age rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/).

### Other App Store declarations

- **Regulated medical device status:** Health & Fitness apps distributed in the EU/EEA, UK or US
  must complete this declaration. For this general habit tracker, the proposed answer is that it
  is not a regulated medical device; confirm intended use when submitting.
- **Accessibility Nutrition Labels:** evaluate common tasks against Apple's criteria before
  claiming support. A screen-reader Finish round shortcut alone is not a full app audit. Keep
  the description's accessibility claims gated on the device QA in `docs/RELEASE.md` too.

Sources: [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information),
[Accessibility Nutrition Labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/).

### App Review notes (paste into "Notes")
Fill in Win Zero Plus's Apple ID (App Store Connect → Win Zero Plus → App Information) before
pasting. Win Zero 1.2 is submitted once Win Zero Plus is live, so its links to Plus open a working page.
```
Win Zero needs no account. To see the main flow quickly:
1. Open the app and enter any goal. Set the check-in time to a time that has already passed today. Today's check-in then opens right away on Home.
2. Tap "Yes, I did" to play the round: tap or hold anywhere to fire. Clearing the last zero shows the celebration and the result sheet.
3. Notifications (optional): allow them in Setup or Settings. Each day's check-in arrives at the chosen time as a notification with Yes / Not today buttons.
4. Settings > Win Zero Plus > "Move to Win Zero Plus" (optional): moves the user's goal, history and rewards into Win Zero Plus, our separate paid app (Apple ID <PLUS_APPLE_ID>), which adds more goals, check-in days and extra games. Win Zero stays complete and free, with no in-app purchases or ads. It offers Plus in only two places: that Settings section, which also links to the store page, and a small "+" beside the goal on Home, which opens a card listing what Plus adds. The move happens on the device, through an App Group the two apps share; nothing goes to a server. Without Win Zero Plus installed, Move opens its App Store page.
Goals and check-ins are stored locally. Notifications are scheduled locally; no app server is required. System backups are managed by the OS. Privacy and support links open our website in the browser.
```

---

## Google Play Console

### Data safety
- **Does your app collect or share any of the required user data types?** **No.**
  - Google doesn't count data that's only processed on the device and never sent off it.
- The listing then reads **"No data collected"** and **"No data shared with third parties"**.
- **Is all user data encrypted in transit?** Not applicable for local-only progress. Follow the
  live form; do not claim encryption for a transfer that does not happen.
- **Do you provide a way for users to request that their data be deleted?** Data is on-device
  only. **Settings → Erase all data** deletes it. The form may not ask once "No" is chosen.
- Confirm against the release artifact, including third-party SDKs. A move into Plus is an
  explicit user action between apps from E7 Systems. Local app-to-app transfers are not
  automatically exempt from Google's sharing rules merely because they are local.

Source: [Google Data safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

### Health apps declaration

All apps must complete **App content → Health apps**. Do not assume the form has a category named
"habit tracking / behavior change" or "general wellness".

- Describe the scope: self-reported goals and check-ins, including suggestions to stop drinking
  or vaping; no body measurements, treatment advice, or Health Connect access.
- Review the live options against that scope. Google's **Mental and Behavioral Health** category
  includes addiction recovery tools; evaluate it if retaining that use case in the product and
  marketing. Do not choose "no health features" solely because no sensors are used.
- Save selected options with the submission record. Do not select unsupported diagnostic,
  clinical or medical-device functions.
- Both Play descriptions include the non-medical-device disclaimer and direction to consult a
  healthcare professional required by the current policy for other health/medical apps.

Sources: [Health declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en),
[Health Content and Services policy](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en).

### Content rating (IARC questionnaire)
- **Category:** **"All other app types"** (the app is a habit tracker with a mini-game).
  - If you'd rather list it as a game, the answers below still apply.
- **Violence:** abstract shapes are destroyed. There are no humans, animals or realistic weapons,
  and no blood.
- **Drugs, alcohol, tobacco:** the app *references* them only as goals to stop (the suggestion
  chips), and never depicts use.
  - Answer the "references" question **Yes**, with that context.
  - Answer the "depicts use" questions **No**.
- **The rest:**
  - User interaction or sharing: **No**. Nothing is shared between users.
  - Location sharing: **No**.
  - Digital purchases: **No**.

### Target audience and content
- **Target age:** confirm the actual intended audience. If it includes teens, select each
  applicable console band (13–15, 16–17 and/or 18+); if adults only, select 18+. This is a product
  decision, separate from the generated content rating. The privacy policy says the app is not
  directed to children under 13.
- **Appeals to children:** **No**.

### Ads
**No**, the app contains no ads.

### App access
**All functionality is available without special access.** There's no login.

### Permissions
Expected permissions below are based on configuration. Check the final merged Android manifest
and Play's permission report; normal permissions do not show an install prompt:
- notifications (asked at runtime, Android 13+)
- vibrate (haptics)
- receive boot completed (to keep scheduled reminders after a restart)
- internet
- modify audio settings (sound effects)

The storage and overlay permissions from the Expo template are removed (`blockedPermissions` in
`app.json`). There's no exact-alarm permission. Reminders are inexact, so they can arrive a few
minutes late.
