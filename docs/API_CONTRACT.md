# CecureUs Mobile API — Proposed Contract (v1)

> **Status: PROPOSED — not yet implemented or confirmed by the backend team.**
> The mobile app is built and tested against this contract using a mock server
> (`src/test/mock-server.ts`). Nothing here has been verified against production.
> Please review, adjust, and confirm (see `BACKEND_BLOCKERS.md`).

## Why a new API is needed

The existing endpoint `https://eap.cecureus.com/api/{table_name}/{id}` returns **raw database rows
without authentication**. For example, `GET /api/doctor_list` currently returns, for all counsellors,
`doc_password` (unsalted MD5), `doc_otp`, `doc_email`, `doc_mobile`, `bank_acc_number`, `bank_ifsc`,
`doc_pannumber` and more. The mobile app **must not** consume that endpoint, and it should be taken
offline or restricted as a priority (see `docs/SECURITY.md`).

The contract below exposes only the fields the app needs, behind authentication.

## Conventions

- Base URL: `${EXPO_PUBLIC_API_BASE_URL}` — proposed `https://eap.cecureus.com/api/mobile/v1`. **HTTPS only.**
- JSON request/response bodies, UTF-8.
- Success envelope: `{ "status": true, "data": <payload> }`
- Error envelope (any 4xx/5xx): `{ "status": false, "message": "<user-safe text>", "code": "<MACHINE_CODE>" }`
  - `message` must be safe to show users (it is displayed for 400/409/422). Never include SQL/stack traces.
  - HTTP status codes: 400/422 validation, 401 not authenticated / session expired, 403 forbidden,
    404 not found, 409 conflict (e.g. slot taken), 429 rate limited (send `Retry-After` seconds), 5xx server error.
- Auth: `Authorization: Bearer <accessToken>` on every endpoint except `auth/login`, `auth/register/*`, `issues`, `languages`.
- IDs may be strings or numbers (the app normalises to strings).
- Timestamps: ISO-8601 with offset, e.g. `2026-11-02T10:00:00+05:30`. Dates: `YYYY-MM-DD`.
- Every user-scoped endpoint must enforce **server-side authorisation**: a user can only read/modify their own data.

## 1. Accounts — sign-up and sign-in (uses the existing `employee_list` table, no schema change)

**Column mapping.** No columns are added or renamed; values are strings as in the dump.

| Field | `employee_list` column | Notes |
|-------|------------------------|-------|
| Account ID | `emp_id` | int primary key |
| Email (user ID) | `emp_email` | lower-cased, unique among `status='active'` rows |
| Mobile (user ID) | `emp_mobile` | E.164 `+91XXXXXXXXXX`, unique among active rows |
| Employee ID (corporate user ID, optional) | `emp_companyid` | unique within the company |
| Password | `emp_password` | **bcrypt/argon2id hash** (the dump looks like unsalted MD5 — rehash on next login) |
| First / last name | `emp_name` / `emp_lname` | |
| Age | `emp_age` | `''` when not set |
| Corporate or individual | `emp_role` | `'corporate'` / `'individual'` — **please confirm this column's meaning** (B-16) |
| Company | `emp_companyname`, `emp_organisationname` | set by the server from the work-email domain |
| Current OTP | `emp_otp` | store a **hash**; one column is enough because email and mobile are verified one after the other |
| Lifecycle | `status` | `'pending'` during sign-up → `'active'` → `'deleted'` |
| Timestamps | `created_at`, `updated_at`, `reg_date` | legacy format `DD-MM-YYYY hh:mm:ss AM` |

OTP issue time, attempt counts, registration tokens and login-failure counters are short-lived server state
(cache/session store), not table columns.

**User ID.** The table has no username column, so a user signs in with **any** of: email, mobile number, or
(corporate) employee ID, plus their password.

### Sign-up flow (each step must succeed before the next)

1. `POST /auth/register/email/request` — `{ "email", "userType": "corporate" | "individual" }`
   → `{ "requestId", "expiresInSeconds": 600, "resendAfterSeconds": 60 }`.
   Creates (or reuses) a `status='pending'` row, stores the OTP in `emp_otp`, emails the code.
   Errors: `409 EMAIL_TAKEN` (active account exists), `422 COMPANY_NOT_REGISTERED` (corporate domain not on file),
   `429 OTP_COOLDOWN` with `Retry-After`.
2. `POST /auth/register/email/verify` — `{ "requestId", "otp" }` → `{ "registrationToken" }`.
   Errors: `422 OTP_INVALID`, `422 OTP_EXPIRED` (10 minutes), `429 OTP_LOCKED` (5 wrong attempts).
3. `POST /auth/register/phone/request` — `{ "registrationToken", "mobile" }` → `{ "requestId", … }`.
   Saves `emp_mobile` on the pending row, stores a new OTP in `emp_otp`, sends it by SMS.
   Errors: `422 INVALID_MOBILE`, `409 MOBILE_TAKEN`, `429 OTP_COOLDOWN`, `422 REGISTRATION_EXPIRED`.
4. `POST /auth/register/phone/verify` — `{ "registrationToken", "requestId", "otp" }` → `null`.
5. `POST /auth/register/complete` — `{ "registrationToken", "firstName", "lastName" | null, "password", "employeeId" | null }`
   → `201` AuthSession (signed in). Sets name, password hash, `emp_companyid`, `reg_date`, `status='active'`,
   clears `emp_otp`. Errors: `422 VERIFICATION_REQUIRED` (email and mobile not both verified),
   `422 WEAK_PASSWORD` (min 8, letter + number), `409 EMPLOYEE_ID_TAKEN`.

### Sign in

`POST /auth/login` — `{ "userId": "<email | mobile | employee ID>", "password" }` → AuthSession.
- Wrong user ID **or** wrong password → the same `422 INVALID_CREDENTIALS` "Incorrect user ID or password."
  (never reveal which accounts exist).
- 5 failures → `429 LOGIN_LOCKED` for 15 minutes (with `Retry-After`).
- Only `status='active'` rows can sign in.

**AuthSession** = `{ "accessToken", "expiresAt", "user": User }`. `POST /auth/logout` revokes the token.

Password reset is not part of Phase 1 (the app points users to support) — see B-17.

## 2. Profile

**User object** (from `employee_list`; never includes `emp_password` or `emp_otp`)
```json
{
  "id": "101",
  "firstName": "Harsha",
  "lastName": "Verma",
  "email": "harsha@company.com",
  "mobile": "+919876543210",
  "userType": "corporate",
  "companyName": "Hyundai",
  "sessionsRemaining": 4,
  "age": 29
}
```
`sessionsRemaining` comes from the corporate entitlement (per-company policy; `null` for individuals).

- `GET /me` → User
- `PATCH /me` — body `{ "firstName", "lastName" | null, "age": 18–100 | null }` → updated User
  (`emp_name`, `emp_lname`, `emp_age`). Email and mobile are verified at sign-up and are not editable here.
  Errors: `422 VALIDATION`, `422 INVALID_AGE`.
- `DELETE /me` — account deletion request (Google Play requirement). Cancels future bookings, deletes or
  anonymises personal data per the privacy policy (`status='deleted'`), revokes all tokens. Response `data`: `null`.

## 3. Reference data (public)

- `GET /issues` → `[{ "id": 1, "name": "Stress" }]` (from `issuse_list` where `status = 'active'`)
- `GET /languages` → `[{ "id": 1, "name": "English" }]` (from `language`)

## 4. Counsellors

**Counsellor object** (only these fields — never bank, PAN, GST, password, OTP, personal email/mobile, Zoom IDs)
```json
{
  "id": "1",
  "name": "Mr. Kannan Parthasarathy",
  "title": "Clinical Psychologist",
  "city": "Chennai",
  "experienceYears": 28,
  "languages": ["English", "Tamil"],
  "expertise": ["Anxiety Management", "Stress Management"],
  "about": "…",
  "imageUrl": "https://eap.cecureus.com/uploads/doctor/1766122184My_Photo-Dec_25.jpeg",
  "rating": 4.9,
  "sessionsCount": 412,
  "modes": ["audio", "video", "chat"]
}
```
Mapping from `doctor_list`: `doc_id`, `doc_name`, `doc_cityname`, `doc_experiance`,
`doct_language`/`doc_prelanguage` → `languages`, `doc_category` → `expertise` (array or comma-separated string accepted),
`doc_areaexport`/`doc_description` → `about`, `doct_image` → `imageUrl` (absolute HTTPS URL preferred; a bare filename
is resolved against `EXPO_PUBLIC_MEDIA_BASE_URL`). `title`, `rating`, `sessionsCount`, `modes` are optional.
**Only `status = 'active'` counsellors may be returned.**

- `GET /counsellors?search=&expertise=&page=` → `{ "items": Counsellor[], "nextPage": 2 | null }`
  - `search` matches name, expertise, language, city. `expertise` filters by category keyword (e.g. `Anxiety`).
- `GET /counsellors/{id}` → Counsellor (404 if inactive/unknown)
- `GET /counsellors/{id}/availability?from=YYYY-MM-DD&to=YYYY-MM-DD` (max 31 days)
```json
{
  "timezone": "Asia/Kolkata",
  "days": [
    { "date": "2026-11-02", "slots": [ { "start": "2026-11-02T10:00:00+05:30", "end": "2026-11-02T11:00:00+05:30" } ] }
  ]
}
```
Computed server-side from `doctor_timelist` (weekly hours), `service` (`service_time`, `service_buffer`) minus
existing non-cancelled `booking_appointment` rows, minus past times. Only bookable slots are returned.

## 5. Bookings

**Booking object**
```json
{
  "id": "5001",
  "counsellorId": "1",
  "counsellorName": "Mr. Kannan Parthasarathy",
  "start": "2026-11-02T10:00:00+05:30",
  "end": "2026-11-02T11:00:00+05:30",
  "mode": "video",
  "issue": "Stress",
  "language": "English",
  "status": "confirmed",
  "joinUrl": "https://zoom.us/j/…",
  "cancellable": true,
  "notification": { "sms": "sent" }
}
```
`status`: `pending` | `confirmed` | `cancelled` | `completed`. The app shows "Booking Confirmed" **only** for `confirmed`.
Maps to `booking_appointment` (`book_id`, `doc_id`, `doc_name`, `booknewdate`+`meating_timelist`/`meating_starttime`/
`meating_endtime`, `connectoption`, `issuse_name`, `speaking_language`, `status`, `join_url`).
`joinUrl` only for the booking's own user, HTTPS only, and never the host `start_url`.

### `POST /bookings`
Headers: `Authorization`, **`Idempotency-Key: <uuid>`** (required).

Body:
```json
{ "counsellorId": "1", "slotStart": "2026-11-02T10:00:00+05:30", "mode": "video",
  "issueId": "1" | null, "language": "English" | null, "notes": "…" | null }
```

Server rules (**required to prevent duplicate bookings and duplicate SMS**):
1. Look up `(user, Idempotency-Key)`. If found, return the **original** response (same booking, no new SMS). Keep keys ≥ 24 h.
2. In a single DB transaction, verify the slot is still available and reserve it (unique constraint on
   counsellor + start time for non-cancelled bookings, or `SELECT … FOR UPDATE`). If taken → `409 SLOT_UNAVAILABLE`.
   (Note: tables are MyISAM, which has **no transactions** — booking tables should move to InnoDB.)
3. Check corporate entitlement (`sessionsRemaining`). Individuals: Phase 1 has **no payment** (see blockers).
4. Commit, then enqueue the SMS notification to **+91 7200500221** via the approved HTTPS SMS integration
   (server-side only, credentials never in the app). Send at most once per booking (store `sms_sent_at`).
   SMS failure must **not** fail or duplicate the booking; report it in `notification.sms` and retry server-side.
5. Respond `201` with the Booking.

- `GET /bookings?page=` → `{ "items": Booking[], "nextPage": … }` — current user's bookings only.
- `POST /bookings/{id}/cancel` — body `{ "reason": "Schedule conflict" }` → updated Booking. `409 NOT_CANCELLABLE`
  if past the cancellation window. Frees the slot.

## 6. Content

- `GET /articles?category=&search=&page=` → `{ "items": ArticleSummary[], "nextPage" }`
  `ArticleSummary`: `{ id, title, category, excerpt, imageUrl, readMinutes, publishedAt }`
- `GET /articles/{id}` → `ArticleSummary + { "contentHtml": "<p>…</p>" }` (from `blog_post.post_content`).
  The app renders HTML as plain text and never executes scripts.
- `GET /videos?category=&page=` → `{ items: [{ id, title, category, thumbnailUrl, videoUrl (HTTPS), durationSeconds }], nextPage }`
  — **no existing table found for videos** (see blockers).

Only published content (`status = 'active'`) should be returned.

## 7. Self assessments

- `GET /assessments` → `[{ id, title, description, imageUrl, questionCount, estimatedMinutes }]` (`quiz_category`)
- `GET /assessments/{id}` → `{ …summary, "questions": [{ "id", "text", "options": [{ "id", "text" }] }] }`
  (`quiz_list` + `quiz_answer`). Do **not** send scoring weights (`quiz_ansfourtick`) to the client.
- `POST /assessments/{id}/submit` — body `{ "answers": [{ "questionId", "optionId" }] }`
  → `{ "percentage": 0-100, "level": "Moderate", "summary": "…" }` (scored server-side using `percentage` bands).
  Results are private to the user and must never be visible to employers/HR.
