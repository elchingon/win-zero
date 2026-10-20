# Store form answers

Answers for the privacy, safety and rating questionnaires in App Store Connect and the Play
Console. The facts below are true of the code on this branch: no network calls of our own, no
analytics or crash SDKs, local notifications only, and data in on-device storage.

Re-check these if anything is added that sends data off the phone.

---

## App Store Connect

### App Privacy ("nutrition label")
- **Data collection:** choose **"No, we do not collect data from this app."** The label then reads
  **Data Not Collected**.
- **Why:** Apple counts data as collected only when it leaves the device and is stored where you
  or a third party can reach it. Win Zero never sends anything off the phone.

### Privacy manifest
Already set in `app.json` (`ios.privacyManifests`):
- No tracking, no tracking domains, no collected data types.
- The required-reason APIs that React Native and the Expo modules use.

If Apple emails about a missing reason after an upload, add it there.

### Export compliance
`ITSAppUsesNonExemptEncryption` is `false` in `app.json`, so App Store Connect won't ask. If it
does ask, answer: the app uses no encryption beyond what the OS provides.

### Age rating
Answer each question honestly. These are the ones that apply:

- **Alcohol, tobacco or drug use or references.** The goal suggestions include "Stop drinking"
  and "Quit vaping", and users can type any goal. These are references to stopping, with no use
  shown.
  - Answer **Infrequent / Mild**.
  - This may raise the rating above 4+. That's expected and fine for this app.
- **Medical or treatment information.** Answer **None**.
  - The app gives no medical advice.
  - It links to a public helpline (SAMHSA) without describing treatment.
  - If a reviewer disagrees, Infrequent is the fallback.
- **Cartoon or fantasy violence.** You shoot abstract zero shapes, with no characters and no
  injury.
  - Most people answer **None**.
  - If you'd rather be cautious, **Infrequent / Mild** is defensible.
- **The rest:**
  - Unrestricted web access: **No**.
  - User-generated content shared with others: **No**. The goal text never leaves the phone.
  - Gambling, contests and loot boxes: **No**. Rewards come only from check-ins (and, in Win
    Zero Plus, a free hidden credit on Home), never from purchases.

### App Review notes (paste into "Notes")
```
Win Zero needs no account. To see the main flow quickly:
1. Open the app and enter any goal. Set the check-in time to a time that has already passed today. Today's check-in then opens right away on Home.
2. Tap "Yes, I did" to play the round: hold anywhere to fire. Clearing the last zero shows the celebration and the result sheet.
3. Notifications (optional): allow them in Setup or Settings. Each evening's check-in arrives as a notification with Yes / Not today buttons.
All data stays on the device. Notifications are scheduled locally; there is no server.
```

---

## Google Play Console

### Data safety
- **Does your app collect or share any of the required user data types?** **No.**
  - Google doesn't count data that's only processed on the device and never sent off it.
- The listing then reads **"No data collected"** and **"No data shared with third parties"**.
- **Is all user data encrypted in transit?** Not applicable, since nothing is transmitted. The
  form skips this once you answer "No" above.
- **Do you provide a way for users to request that their data be deleted?** Data is on-device
  only. **Settings → Erase all data** deletes it. The form may not ask once "No" is chosen.

### Health apps declaration
Apps in Health & Fitness, or with health features, fill in **App content → Health apps**.
- Choose the option closest to **habit tracking / behavior change**.
- Win Zero doesn't measure the body, give medical advice, or connect to Health Connect.
- If no option fits, choose the general wellness one.
- Don't select anything about medical devices, treatment, or clinical use.

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
- **Target age:** 18+, or 13+ if you want. Choosing ages under 13 brings in the Families
  policies, which this app isn't built around.
- **Appeals to children:** **No**.

### Ads
**No**, the app contains no ads.

### App access
**All functionality is available without special access.** There's no login.

### Permissions
The release build asks for nothing at install. It declares:
- notifications (asked at runtime, Android 13+)
- vibrate (haptics)
- receive boot completed (to keep scheduled reminders after a restart)
- internet
- modify audio settings (sound effects)

The storage and overlay permissions from the Expo template are removed (`blockedPermissions` in
`app.json`). There's no exact-alarm permission. Reminders are inexact, so they can arrive a few
minutes late.
