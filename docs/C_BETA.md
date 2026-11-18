# "c_beta" — Google Play test release

`c_beta` is a **separate test app** on Google Play built from this branch (`feature/c-beta`, the
table-backend version that works today). It exists so the real launch can later use the real name and package.

| | c_beta (this) | Real launch (later) |
|---|---|---|
| Play Store / home-screen name | `c_beta` | `CecureUs` |
| Package (permanent once uploaded) | `com.cecureus.app.beta` | `com.cecureus.app` |
| What the screens say | **CecureUs** (unchanged) | CecureUs |
| Build profile | `beta` (AAB) / `beta-apk` (APK) | `production` |

The variant is set in `app.config.js` (`APP_VARIANT=beta`); `eas.json` holds the public settings for it.
Nothing about users is built in — there are no demo accounts. Testers create their own account with
**Get Started** and sign in with their mobile number and the SMS code.

## Beta code
When a c_beta build opens, it first asks for the **beta code `AJDS`** (not case-sensitive). Nothing else in the
app opens until it is entered; the phone then remembers it, so testers type it once per install. Give the code
to your testers together with the Play opt-in link.

- Only the `beta` / `beta-apk` builds ask for it (`EXPO_PUBLIC_BETA_GATE=true` in `eas.json`); normal and
  production builds never show it.
- The code is fixed in `src/features/beta/beta-gate.tsx` (`BETA_CODE`). Changing it and shipping a new build makes
  every tester enter the new code once.
- It is checked inside the app, so it keeps casual installs out — it is not real security.

## Known limits of this test build (accepted for testing)
- The SMS Integra login is compiled into the app (`EXPO_PUBLIC_SMS_URL_TEMPLATE`) and can be extracted from it.
- Sign-in downloads the whole `employee_list` from the public table API and checks the SMS code on the phone.
- So keep it on **Internal testing** (invite-only). Don't promote this listing to Production; the real launch
  uses the CECUREUS_DEPLOY version with the server-side API.

## 1. One-time setup (on your PC, in this folder)

```bash
git checkout feature/c-beta
npm ci
npx eas-cli@latest login          # your Expo account
npx eas-cli@latest init           # links the project — commit the projectId it adds to app.json
```

Store the SMS settings in EAS (never in git — this repo is public). Use **single quotes** around the value
(PowerShell and Git Bash both need them because of the `&` and `{}`):

```bash
npx eas-cli@latest env:create --environment preview --visibility sensitive --name EXPO_PUBLIC_SMS_URL_TEMPLATE --value 'https://www.smsintegra.com/api/smsapi.aspx?uid=YOUR_UID&pwd=YOUR_PWD&mobile={mobile91}&msg={message}&sid=YOUR_SID&type=0&dtTimeNow={date}&entityid=YOUR_ENTITY_ID&tempid=YOUR_TEMPLATE_ID'
# Only if your DLT-approved text differs from the default in src/api/table-backend/sms.ts:
npx eas-cli@latest env:create --environment preview --visibility sensitive --name EXPO_PUBLIC_SMS_MESSAGE --value 'Your CecureUs verification code is {otp}. It is valid for 10 minutes. Do not share this code with anyone.'
```

Replace only the `YOUR_…` parts; keep `{mobile91}`, `{message}`, `{date}` exactly as written.

## 2. Try it on a phone first (APK, no Play Store)

```bash
npx eas-cli@latest build -p android --profile beta-apk
```

EAS asks to create an Android keystore for `com.cecureus.app.beta` — answer **yes** (EAS keeps it).
Open the link it prints on your phone, install, then: beta code `AJDS` → Get Started → sign up → sign in with
the SMS code → book a session. The home-screen icon says **c_beta**; inside, everything says CecureUs.

## 3. Build for Google Play (AAB)

```bash
npx eas-cli@latest build -p android --profile beta
```

Download the `.aab` from the build page when it finishes.

## 4. Put it on Google Play (Internal testing)

1. [Play Console](https://play.google.com/console) → **Create app** → App name **`c_beta`**, App, Free → create.
   (Health apps must be published from an **organisation** developer account.)
2. **Testing → Internal testing → Testers**: create an email list with your testers' Google accounts.
3. **Create new release** → upload the `.aab` → turn on **Play App Signing** when asked → release name e.g. `1.0.0 beta` → **Save → Review release → Start rollout to Internal testing**.
4. Complete the **Set up your app** tasks Play Console asks for before the first rollout (privacy policy URL,
   app access, ads, content rating, target audience, data safety, health apps declaration). The privacy policy
   URL must be a live page.
5. Copy the **opt-in link** from Internal testing → testers open it on their phone, accept, and install
   **c_beta** from the Play Store.

## 5. Next test versions

```bash
npx eas-cli@latest build -p android --profile beta      # version code goes up automatically
```

Upload the new `.aab` to a new Internal testing release, or automate it once you have a Play service-account key
(Play Console → Setup → API access; keep the JSON out of git):

```bash
npx eas-cli@latest submit -p android --profile beta
```
