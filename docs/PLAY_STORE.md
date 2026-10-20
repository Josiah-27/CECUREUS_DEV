# Google Play Release Preparation

Account: organisation developer account owned by CecureUs (`connect@cecureus.com`). Organisation accounts need
D-U-N-S verification. **Nothing has been submitted. No money has been spent.**

## Timeline risk (launch target 31 Oct 2026)
- **Personal** developer accounts created after Nov 2023 must run a **closed test with ≥12 testers for 14 continuous
  days** before production access. An **organisation** account is exempt — confirm which account type CecureUs has.
- First review of a new app can take several days (longer for health apps). Health apps must complete the
  **Health apps declaration**.
- Realistically, with backend blockers open on 20 Oct, a 31 Oct public launch is at high risk; an **internal testing**
  release by 31 Oct is achievable once the API exists.

## Technical checklist
| Item | Value / status |
|------|----------------|
| Application ID | `com.cecureus.app` — **permanent once published; confirm before first upload** |
| App name | CecureUs |
| Version | 1.0.0; versionCode managed remotely by EAS (`autoIncrement`) |
| Target API | Expo SDK 57 / React Native 0.86 target Android 16 (API 36) by default — verify in the built AAB (`aapt dump badging`) |
| Signing | EAS-managed upload key + Play App Signing (recommended) |
| Format | AAB via `eas build -p android --profile production` |
| Permissions | INTERNET only; camera/mic/location/storage/overlay blocked |
| Icon | Interim icon extracted from the design PDF — **replace with official high-res logo (1024×1024 PNG / SVG)** |

## Store listing (draft)
**Short description (≤80):** Confidential counselling, self-assessments and wellbeing tools at work and beyond.

**Full description:**
CecureUs helps you look after your mental health — privately and confidentially.

• Talk to certified counsellors: browse verified psychologists by expertise and language, see availability and book audio, video or chat sessions.
• Self assessments: quick check-ins for stress, burnout, anxiety and work-life balance.
• Breathing exercises: guided 2-minute calm breathing, box breathing, sleep relaxation, panic reset and grounding.
• Private journal, goals and mood tracking stored securely on your device.
• Articles and videos curated by experts.
• Help when you need it: 24/7 confidential helpline 1800 121 9497 and WhatsApp support.

For employees of partner organisations, sessions are covered by your company's wellness programme. Your employer
never sees your conversations, journal, assessment answers or which counsellor you booked.

CecureUs is not an emergency service. If you are in immediate danger, call 112.

**Category:** Health & Fitness (or Medical — confirm). **Screenshots:** capture from the preview build (Home,
Counsellors, Booking, Explore, Breathing, Profile) at 1080×1920+; feature graphic 1024×500.

## Data safety form (draft — confirm with backend behaviour)
| Data type | Collected | Shared | Purpose | Notes |
|-----------|-----------|--------|---------|-------|
| Name | Yes | No | Account management | |
| Email address | Yes | No | Account management, authentication | OTP login |
| Phone number | Optional | No | Account management | |
| Health info (booking topic, notes, assessment results) | Yes | No | App functionality | Sent to CecureUs servers; counsellor sees booking notes |
| Journal, mood, goals | **Not collected** | — | — | Stored only on device |
| App interactions / diagnostics | No (Phase 1) | — | — | Update if analytics/crash reporting is added |

Data encrypted in transit: Yes (HTTPS). Users can request deletion: Yes — in-app (Profile → Delete Account) **and**
a public web URL (required; to be provided, B-13/B-15).

## Content rating
IARC questionnaire: no violence/sexual content/gambling; user-to-counsellor communication happens outside the app
(Zoom/phone) in Phase 1. Expect "Everyone"/"3+" with "Users interact" if chat is added.

## Reviewer access (App content → App access)
Provide a staging/production test account with a **fixed review OTP** that only works for that email, plus a test
counsellor with open slots. Without it, review will be rejected because login is required.

## Release steps (require explicit approval before each)
1. `npx eas-cli@latest login` (CecureUs Expo account) and `eas init` to link the project.
2. Set env vars: `eas env:create --environment preview|production` for all `EXPO_PUBLIC_*` keys in `.env.example`.
3. `eas build -p android --profile preview` → install APK, run Maestro flows + manual plan.
4. `eas build -p android --profile production` → AAB.
5. Upload to **Internal testing** (manually or `eas submit -p android --profile production`, needs Play service account JSON).
6. Closed testing (if personal account: 12 testers × 14 days) → Production.
