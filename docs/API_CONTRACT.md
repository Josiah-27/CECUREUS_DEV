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
- Auth: `Authorization: Bearer <accessToken>` on every endpoint except `auth/otp/*`, `issues`, `languages`.
- IDs may be strings or numbers (the app normalises to strings).
- Timestamps: ISO-8601 with offset, e.g. `2026-11-02T10:00:00+05:30`. Dates: `YYYY-MM-DD`.
- Every user-scoped endpoint must enforce **server-side authorisation**: a user can only read/modify their own data.

## 1. Authentication (email OTP)

### `POST /auth/otp/request`
Request: `{ "email": "name@company.com", "userType": "corporate" | "individual" }`

Response `data`: `{ "requestId": "abc123", "expiresInSeconds": 600, "resendAfterSeconds": 60 }`

Server rules (**must be enforced server-side**):
- Generate a cryptographically random 6-digit OTP; store only a hash; valid for **10 minutes**.
- Resend cooldown (proposed 60 s) → `429` with `code: OTP_COOLDOWN` and `Retry-After`.
- Per-email and per-IP rate limits.
- For `corporate`: verify the email domain / employee record belongs to a registered, active company
  (`organization`, `employee_list`). If not: `422` with a clear `message` (e.g. `code: COMPANY_NOT_REGISTERED`).
- Do not reveal whether an individual account already exists.
- Send the email via the approved provider. **Never return the OTP in the response or logs.**

### `POST /auth/otp/verify`
Request: `{ "requestId": "abc123", "email": "name@company.com", "otp": "123456" }`

Response `data`:
```json
{
  "accessToken": "opaque-or-JWT",
  "expiresAt": "2026-12-01T00:00:00+05:30",
  "user": { /* User, see §2 */ }
}
```
Errors: `422 OTP_INVALID`, `422 OTP_EXPIRED`, `429 OTP_LOCKED` (after 5 wrong attempts the OTP is invalidated).
OTP is single-use. Creates the user record on first successful verification (individual users).

### `POST /auth/logout`
Revokes the access token server-side. Response `data`: `null`.

## 2. Profile

**User object**
```json
{
  "id": "101",
  "firstName": "Harsha",
  "lastName": "Verma",
  "email": "harsha@company.com",
  "mobile": "+919876543210",
  "userType": "corporate",
  "companyName": "Hyundai",
  "sessionsRemaining": 4
}
```
Maps from `employee_list`: `emp_id`, `emp_name`, `emp_lname`, `emp_email`, `emp_mobile`, `emp_companyname`.
`sessionsRemaining` comes from the corporate entitlement (per-company policy; `null` for individuals).

- `GET /me` → User
- `PATCH /me` — body `{ "firstName", "lastName" | null, "mobile" | null }` → updated User. Validate server-side.
- `DELETE /me` — account deletion request (Google Play requirement). Cancels future bookings, deletes or
  anonymises personal data per the privacy policy, revokes all tokens. Response `data`: `null`.

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
