# Security & Privacy Review — Phase 1

Date: 2026-10-20. Scope: mobile app source in this repo + read-only observation of the public API.

## Critical findings (backend)

| # | Severity | Finding | Recommendation |
|---|----------|---------|----------------|
| S-1 | **Critical** | `GET https://eap.cecureus.com/api/doctor_list` is unauthenticated and returns password hashes (unsalted MD5), OTP codes, personal email/mobile, bank account numbers, IFSC, PAN and Zoom IDs for all counsellors. | Disable/restrict the generic `/api/{table}` endpoint immediately; rotate secrets; force password resets; move to bcrypt/argon2; evaluate DPDP Act breach obligations. |
| S-2 | High | Passwords stored as unsalted MD5 (`doc_password`, likely `emp_password`, `admin_password`). | Re-hash on next login with bcrypt/argon2id. |
| S-3 | High | OTPs stored in plaintext columns (`doc_otp`, `emp_otp`). | Store a hash with expiry; never return it in any API. |
| S-4 | High | SMS gateway credentials were shared in plain text and the SMS endpoint is plain HTTP. | Rotate credentials; call SMS only from the server over HTTPS. |
| S-5 | Medium | Booking tables use MyISAM (no transactions) → double-booking race conditions. | Migrate to InnoDB; unique index on counsellor + start time. |
| S-6 | Medium | `token` table stores an `access_token` (likely Zoom) in plaintext. | Encrypt at rest; restrict access. |

Only `doctor_list` was observed (plus non-sensitive `doctor_category`). User, booking, admin and token tables
were deliberately **not** requested.

## Mobile app controls (verified in this repo)

| Control | Status | Evidence |
|---------|--------|----------|
| No secrets in source or bundle | ✅ Verified | Source grep + scan of the exported Android Hermes bundle: no keys/passwords/DB/SMS strings. |
| No MySQL / SMS connection from the client | ✅ Verified | Only HTTPS JSON API via `src/api/client.ts`. |
| HTTPS enforced | ✅ Verified | `src/config/env.ts` rejects non-HTTPS URLs except local mock servers in development (tested). |
| Tokens in hardware-backed storage | ✅ | `expo-secure-store` (Android Keystore); excluded from Android backup (`configureAndroidBackup`). |
| No OTP/token logging | ✅ | ESLint `no-console` (only warn/error allowed); no logging in auth paths. |
| Response validation | ✅ Verified | zod schemas; unknown fields stripped — tested that leaked sensitive fields never reach app state. |
| Server errors not leaked to users | ✅ Verified | `friendlyMessage` shows server text only for validation/conflict (tested). |
| 401 handling | ✅ Verified | Global sign-out + "session expired" message (tested). |
| Duplicate booking / SMS prevention (client side) | ✅ Verified against mock | Idempotency-Key reuse on retry, in-flight guard (tested). Server support required (B-06). |
| Private on-device data | ✅ | Journal/mood/goals encrypted via SecureStore, never sent to the server (tested). Wiped on account deletion (tested). |
| Account deletion | ✅ UI + API call | `DELETE /me` (endpoint pending, B-13). |
| Android permissions | ✅ | `permissions: []` + blocked camera/mic/location/storage/overlay. Only INTERNET (default). |
| HTML content | ✅ | Articles rendered as plain text; no WebView, no script execution. |
| Deep-link / URL safety | ✅ | Only `https:` media/video/join URLs are opened; `javascript:`/`http:` rejected (tested). |
| Server-side authorisation | ❌ Not verifiable | Backend not available. Must be verified in integration testing. |

## Remaining client-side considerations
- Certificate pinning: not implemented (adds operational risk for a small team); revisit after launch.
- Root/jailbreak detection: not implemented (not required for Phase 1).
- Screenshots of sensitive screens are allowed; consider `FLAG_SECURE` for journal in a later phase.
