# Test Plan

## Automated (runs on any machine: `npm run check`)

| Layer | Tool | What | Status |
|-------|------|------|--------|
| Types | `tsc --noEmit` | Whole project, strict | ✅ passing |
| Lint | `expo lint` (ESLint 9 + React Compiler rules) | Whole project | ✅ passing |
| Unit | Jest + jest-expo | env validation, API client (timeouts, errors, envelopes), schemas (incl. sensitive-field stripping), contact links, validation, dates, HTML, breathing, streaks, secure storage | ✅ passing |
| Integration | Jest + RNTL + `expo-router/testing-library` against the in-memory mock API | Full route tree: OTP login (valid/invalid/expired/cooldown/lockout/network/server errors), session restore/expiry/401/logout, booking (happy path, slot taken, lost-response retry with same Idempotency-Key, double tap, pending, server error, empty/stale availability, modes, corporate notice), history & cancel, directory search/debounce/errors, profile edit & delete, content, assessments, journal, breathing, Talk to Us, tabs | ✅ passing (mock backend) |
| Bundle | `expo export --platform android` | Production JS/Hermes bundle builds; scanned for secrets | ✅ passing |
| Config | `expo-doctor` | 21 checks | ✅ passing |
| E2E | Maestro (`.maestro/`) | Login, booking, emergency | ⛔ **NOT RUN** — no emulator on build machine |
| Backend integration | — | Real API | ⛔ **NOT RUN** — backend endpoints not available (BACKEND_BLOCKERS.md) |
| Native build | EAS Build | APK / AAB | ⛔ **NOT RUN** — needs Expo account login |

Mutation checks performed: breaking idempotency-key reuse, showing pending bookings as confirmed, and dialling
without confirmation each made the corresponding test fail.

## Manual device test plan (preview APK)

Run on at least: one low-end Android 10/11 device, one Android 14–16 device, one small screen (≤5.5"), with TalkBack once.

| # | Scenario | Expected |
|---|----------|----------|
| M1 | Fresh install → open app | Splash with CecureUs logo → welcome screen; emergency number visible |
| M2 | Corporate login with registered work email | Code email arrives within 1 min; code works; lands on Home with company "Covered by…" card |
| M3 | Wrong code ×5 | Error each time; then lockout message |
| M4 | Wait 10+ minutes, enter code | "Code expired"; resend works after cooldown |
| M5 | Kill & reopen app | Still signed in |
| M6 | Airplane mode on Counsellor tab | Offline message + Try again; recovers when online |
| M7 | Book a session (video) | Confirmation only after server confirms; SMS received at +91 7200500221 exactly once; appears in My Sessions |
| M8 | Book the same slot on two phones simultaneously | One succeeds, the other sees "slot was just booked" |
| M9 | Turn network off right after tapping Confirm, then retry | Exactly one booking and one SMS |
| M10 | Cancel a session | Status Cancelled; slot available again |
| M11 | Emergency banner → Call | Confirmation dialog; dialer opens with 1800 121 9497; no automatic call |
| M12 | Talk to Us → WhatsApp | WhatsApp opens chat with +91 72005 00221 (browser if not installed) |
| M13 | Journal entry → uninstall/reinstall | Entry is gone (device-only, documented) |
| M14 | Delete account | Signed out; cannot sign back into the deleted account's data |
| M15 | Font size "Largest" + TalkBack | Text not clipped; all buttons announced with labels |
| M16 | Rotate / split screen | Portrait locked; no crashes |
