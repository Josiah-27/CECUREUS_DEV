# Backend Blockers & Open Questions

Last updated: 2026-10-20. The app is implemented and tested against the **proposed** contract in
`docs/API_CONTRACT.md` using a deterministic mock server. **No feature below has been tested against a
real CecureUs backend.** Mock-tested ≠ production-ready.

| ID | Feature | Missing | Blocks release? |
|----|---------|---------|-----------------|
| B-00 | **Security** | Public `/api/{table}` endpoint leaks counsellor password hashes, OTPs, bank & PAN data | **YES — fix immediately** |
| B-01 | All | Mobile API base URL, auth scheme and confirmation of the contract | **YES** |
| B-02 | Sign-up / sign-in | Registration (email OTP → mobile OTP → details) and password login endpoints | **YES** |
| B-03 | Login | Corporate eligibility rules (domain / employee list / company status) | **YES** |
| B-04 | Counsellors | Sanitised counsellor list/detail endpoints | **YES** |
| B-05 | Calendar | Availability endpoint (slots computed server-side) | **YES** |
| B-06 | Booking | Booking create with idempotency + transactional slot reservation | **YES** |
| B-07 | Booking SMS | Server-side HTTPS SMS integration to +91 7200500221, rotated credentials | **YES** |
| B-08 | Booking | History + cancel endpoints, cancellation policy | Yes (history) |
| B-09 | Media | Base URL for `doct_image` / blog images | Yes (photos) |
| B-10 | Articles | Article list/detail endpoints | Yes |
| B-11 | Videos | Video source (no table in schema) | No (screen shows empty state) |
| B-12 | Assessments | Quiz endpoints + server-side scoring | No (section shows empty/error state) |
| B-13 | Account | Profile update + account deletion endpoints | **YES** (Play policy) |
| B-14 | Individuals | Booking policy for individual users with payments excluded | **YES (product decision)** |
| B-15 | Legal | Privacy policy & terms URLs, data deletion web page | **YES** (Play policy) |
| B-16 | Accounts | Confirm meaning of `employee_list.emp_role` and existing password hashing | **YES** |
| B-17 | Accounts | Password reset (forgot password) flow | No (support email for now) |

---

### B-00 — Unauthenticated data exposure (CRITICAL)
- **Finding:** `GET https://eap.cecureus.com/api/doctor_list` (no auth) returns all 35 counsellor rows including
  `doc_password` (unsalted MD5), `doc_otp`, `doc_email`, `doc_mobile`, `bank_acc_number`, `bank_ifsc`,
  `bank_name`, `doc_pannumber`, `zoomid`. Other table names may be similarly exposed (I did not probe user/booking/admin tables).
- **Ask:** Restrict or disable the generic `/api/{table}` endpoint now; rotate affected credentials; force counsellor
  password resets and migrate to bcrypt/argon2; assess DPDP Act 2023 breach-notification obligations.
- **Test strategy:** n/a — the app never calls this endpoint.

### B-01 — API base URL and contract
- **Why:** Every networked feature depends on it.
- **Question:** Will you implement `docs/API_CONTRACT.md` (or send your actual contract)? What is the production
  and staging base URL? Is the token opaque or JWT, and what is its lifetime? Is a staging environment with test
  accounts available for integration testing?
- **Temporary strategy:** Mock server + `EXPO_PUBLIC_API_BASE_URL`.

### B-02 — Sign-up and sign-in
- **Implemented in the app** against `docs/API_CONTRACT.md` §1 using only existing `employee_list` columns
  (verified by a test that the stored row has exactly the table's columns).
- **Question:** Which email provider sends the sign-up code and which SMS route (SMS Integra) sends the mobile code?
  Can you confirm server-side 10-minute expiry, 60 s resend cooldown, 5-attempt lockout, OTPs stored hashed in
  `emp_otp`, and login lockout after 5 failures? Do existing users (already in `employee_list`) have passwords, or
  do they need a one-time "set password" step?

### B-03 — Corporate eligibility
- **Question:** How is a corporate user verified — email domain whitelist per company, pre-loaded `employee_list`,
  or employee ID? What happens when the company contract is inactive? Where do per-company entitlements
  (sessions/year, session types) live? (`organization` has no entitlement columns.)

### B-04 / B-05 — Counsellors and availability
- **Question:** Confirm the counsellor field list in the contract. How is `doctor_timelist` stored (time format,
  12/24h, timezone)? What is the slot length / buffer (`service` table)? Are availability exceptions (leave) stored?
  Which counsellors support audio/video/chat?

### B-06 — Booking integrity
- **Question:** Can you support `Idempotency-Key` and transactional slot reservation? The booking tables are
  **MyISAM (no transactions/row locks)** — can they move to InnoDB with a unique index on (doc_id, start time, active)?
  Is a booking confirmed immediately or does the counsellor approve it (`pending`)?
  How are Zoom meetings created — synchronously on booking or later?

### B-07 — Booking SMS
- **Question:** Please confirm the SMS Integra HTTPS API, sender ID and DLT-approved template text for the booking
  alert to +91 7200500221. Should the user or counsellor also receive an SMS? **The SMS credentials previously
  shared must be rotated** and kept only on the server; the plain-HTTP SMS URL must not be used from the app.

### B-08 — History and cancellation
- **Question:** What is the cancellation window/policy? Can users reschedule? Should cancelled-by-counsellor be shown?

### B-09 — Media URLs
- **Question:** What is the public HTTPS base URL for `doct_image` and `post_image` files? (e.g. `/uploads/doctor/`).

### B-10 / B-11 — Articles and videos
- **Question:** Should articles come from `blog_post` or the website CMS? Where are videos stored (YouTube links? a
  table not in this dump?). Article categories — do they match Stress/Anxiety/Sleep/Workplace/Relationships?

### B-12 — Assessments
- **Question:** Are `quiz_*` + `percentage` tables the source for Stress/Burnout/Anxiety/Work-life assessments?
  Confirm scoring should be server-side and that results are private to the user.

### B-13 — Account deletion
- **Question:** What data must be retained (invoices, legal) vs deleted? We also need a public web URL for
  deletion requests for the Play Console Data safety form.

### B-14 — Individual users in Phase 1 (product decision)
- **Question:** Payments are excluded from Phase 1. Should individual (B2C) users be able to book at all? Options:
  (a) hide booking for individuals, (b) allow booking as `pending` with offline payment, (c) free first session.
  The app currently allows booking and relies on the server's `status` (shows "Request received" for `pending`).

### B-15 — Legal pages
- **Question:** Confirm the privacy policy and terms URLs (placeholders: `https://cecureus.com/privacy-policy`,
  `https://cecureus.com/terms`). They must be live before Play submission.

### B-16 — `employee_list` semantics
- **Question:** The app stores corporate/individual in `emp_role` ('corporate' / 'individual'). Is that the right
  column, or do `emp_option` / `position` already mean something else? What values does `status` use today
  (the app uses 'pending' during sign-up, 'active', 'deleted')? How are current `emp_password` values hashed?
  (They should be migrated to bcrypt/argon2id.)

### B-17 — Password reset
- **Question:** Phase 1 shows "email support to reset your password". Should we add a reset flow
  (OTP to verified email or mobile → new password)? It fits the same table without schema changes.
