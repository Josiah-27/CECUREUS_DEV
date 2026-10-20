# PROJECT_STATUS

Last updated: **2026-10-20** · Branch: `feature/phase1-app` · Target launch: 2026-10-31

## Overall release readiness: 🔴 NOT READY

The Phase 1 app is implemented and passes all automated checks **against a mock backend**. It cannot be
released until the backend API exists (BACKEND_BLOCKERS.md B-00…B-07, B-13…B-15), a native build has been
produced and tested on a device, and the legal URLs and final app ID are confirmed.

`npm run check` → typecheck ✅ · lint ✅ · **120/120 tests ✅** (12 suites). `expo-doctor` 21/21 ✅. Android production JS bundle export ✅.

## UI redesign (Figma "Build Prototype") — branch `feature/figma-ui`
Source: the Figma Make code export `Build Prototype.zip` (22 Jun 2026); the live Figma link could not be read
(Figma connector not authorised). Ported to React Native: Nunito font, brand tokens, Lucide icons, top bar with
menu + notifications, custom bottom bar with raised Ally button, splash + user-type choice, and the Home, Explore,
Ally, Counsellor and Profile layouts. Real data and safety logic were kept; the prototype's fake counsellors,
fake "Booked!" button and canned Ally replies were **not** copied.
Deliberate deviations: buttons/teal text use `#0E847E` (white on design teal `#17B8B0` is 2.5:1, below WCAG AA);
Profile drops "Change Password" (OTP login has no password) and "Notification Preferences" (no push in Phase 1).
Added: article read history ("Blogs Completed"), bookmarks, side menu, notifications empty state, web preview +
`npm run mock-api`. Verified with headless-Edge screenshots of the web preview against the mock API.
Icons are imported per-file (full Lucide index grew the Android bundle 3.2 → 5.5 MB; now 3.4 MB).
Jest capped at 50% workers (8 GB RAM machine was swapping with 11 workers).

## Accounts update (sign-up / sign-in)
- **Get Started** → corporate or individual → **email OTP → mobile OTP → name (+ optional employee ID) → password**
  → account created and signed in. **I already have an account** → user ID (email, mobile or employee ID) + password.
- **Edit Profile** adds **Age** (optional, 18–100, `emp_age`); email and mobile are read-only (verified at sign-up).
- Uses the existing `employee_list` table only — no columns added (test-enforced). See API_CONTRACT §1.
- Demo mode keeps its fake database on the device and seeds a demo account.
- Replaces the earlier email-OTP-only login. Tests: 141 passing.

## Module status

| # | Module | State | Notes |
|---|--------|-------|-------|
| 0 | Repository & environment audit | VERIFIED | Workspace and GitHub repo were empty → new Expo app. Earlier Firebase/SDK 51 prototype found on Desktop; not used (conflicts with MySQL backend, can't target API 36). |
| 1 | Dev & test infrastructure | VERIFIED | Jest 29 + jest-expo 57 + RNTL 13 + ESLint 9; runner proven to detect a deliberate failure (canary removed); lint proven to flag violations. |
| 2 | Design system & app shell | IMPLEMENTED | Tokens, Button/Card/TextField/Chip/states/Avatar/Screen, 5-tab shell, safe areas, keyboard, a11y labels. Visual comparison with the running app on a device: **NOT TESTED** (no emulator; Figma not connected). |
| 3 | API client foundation | VERIFIED (mock) | Timeouts, cancellation, error mapping, envelopes, zod parsing, 401 handling, Idempotency-Key. Real endpoints: **BLOCKED** (B-01). |
| 4 | Authentication (email OTP) | VERIFIED (mock) | Valid/invalid/expired OTP, cooldown, lockout, network/server errors, persistence, logout, expired & revoked sessions. Real backend: **BLOCKED** (B-02, B-03). |
| 5 | Profile & navigation | VERIFIED (mock) | Profile view, edit with validation, delete account, privacy screen. Real backend: **BLOCKED** (B-13). |
| 6 | Counsellor directory & calendar | VERIFIED (mock) | Search (debounced), expertise filters, pagination, profile, 14-day calendar, time-zone labelling, stale-slot filtering, empty/error states. Real data: **BLOCKED** (B-04, B-05, B-09). |
| 7 | Booking & SMS notification | VERIFIED (mock, client side) | Idempotent submit, slot-taken handling, lost-response retry (1 booking / 1 SMS), double-tap guard, pending vs confirmed, history & cancel. SMS is server-side → **BLOCKED** (B-06, B-07). |
| 8 | Articles & videos | VERIFIED (mock) | Lists, category filter, search, pagination with de-dupe, detail (safe HTML→text), videos via in-app browser. Real content: **BLOCKED** (B-10, B-11). |
| 9 | Talk to Us | VERIFIED | WhatsApp `https://wa.me/917200500221`, dialer `tel:18001219497` behind a confirmation dialog; fallbacks tested. On-device check: **NOT TESTED**. |
| 10 | Security & privacy | IMPLEMENTED | Client controls verified (docs/SECURITY.md). **Critical backend data exposure found (B-00).** Server-side authorisation: **NOT TESTED**. |
| 11 | Full regression | VERIFIED (automated) | All automated suites pass. Maestro E2E: **NOT RUN** (no emulator). |
| 12 | Android release build | BLOCKED | No Java/Android SDK locally; EAS Build needs Expo account login (`eas login`) + approval. `eas.json` ready. |
| 13 | Play Store preparation | IMPLEMENTED (docs) | Listing draft, data safety, rating, reviewer access, timeline risks in docs/PLAY_STORE.md. Nothing submitted. |
| — | Extra Phase 1 screens from designs | VERIFIED (local) | Breathing exercises, journal, goals, progress, self-assessments (assessments need B-12), Ally placeholder. |

## Environment facts (build machine)
Windows 11, Node 24.21, npm 11.19, Git 2.55. **Not available:** Java, Android SDK/emulator, Maestro, EAS CLI login,
GitHub CLI. Note: `~/.npmrc` contains `allow-scripts=pnmp` which breaks `npx expo install` (packages were installed
with pinned versions via npm instead).

## Key files
- App: `src/app/**` (routes), `src/api/*`, `src/auth/*`, `src/features/booking/*`, `src/local/*`, `src/lib/*`
- Tests: `src/**/__tests__/*`, mock backend `src/test/mock-server.ts`, harness `src/test/harness.ts`
- Config: `app.json`, `eas.json`, `.env.example`, `eslint.config.js`, `jest.setup.ts`, `package.json` (jest config)
- Docs: `BACKEND_BLOCKERS.md`, `docs/API_CONTRACT.md`, `docs/SECURITY.md`, `docs/TEST_PLAN.md`, `docs/PLAY_STORE.md`

## Commands executed (summary)
`create-expo-app --template default@sdk-57` (scratch dir, selected files copied) · `npm install` · test/lint deps ·
`tsc --noEmit` · `expo lint` · `jest --ci --coverage` (×many) · `expo-doctor` · `expo export --platform android` ·
bundle secret scan · read-only `GET` of `/api/doctor_list` (field names only recorded) and `/api/doctor_category`.

## Bugs found & fixed during testing
1. Name validation rejected Tamil/Hindi names (missing Unicode combining marks).
2. HTML converter split list items into separate paragraphs.
3. Edit Profile / breathing "finish" crashed with no back history (deep link) → `goBackOr` fallback.
4. Paged lists could render duplicate items (offset pagination) → de-duplicate by id.
5. Several React Compiler violations (ref writes / impure calls during render, setState in effects) → rewritten.

## Outstanding issues
- Interim app icon/logo extracted from the low-resolution design PDF → need official high-res assets.
- Visual parity with Figma not verified on a device.
- No push notifications / session reminders (needs backend + FCM) — not in Phase 1 scope confirmation.
- No analytics or crash reporting (add only with updated Data safety form).

## Next steps
1. Backend team: fix B-00 immediately; confirm/implement the API contract; provide staging + test accounts.
2. Point `EXPO_PUBLIC_API_BASE_URL` at staging; run integration tests and the manual plan.
3. `eas login` → preview APK → Maestro + manual device tests → production AAB → Play internal testing.
