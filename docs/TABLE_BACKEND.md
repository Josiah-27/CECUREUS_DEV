# Table backend: how the app uses the CecureUs table API

The app connects to `https://eap.cecureus.com/api/{table}` and `/api/{table}/{id}`. It uses only GET, POST, PUT and DELETE, and only these four tables: `employee_list`, `doctor_list`, `doctor_category` and `booking_appointment`.

The logic lives in [`src/api/table-backend/`](../src/api/table-backend). It answers the app's normal API calls on the phone, so no screen talks to the tables directly.

It is turned on with `EXPO_PUBLIC_BACKEND=table`. When the CecureUs server provides the endpoints in [API_CONTRACT.md](API_CONTRACT.md), switch to `EXPO_PUBLIC_BACKEND=api`. The screens don't change.

## What the app reads and writes

| Table | Read | Write |
|---|---|---|
| `employee_list` | Sign-in: finds the row whose `emp_mobile` matches and whose `status` is `Active`. Profile: `/employee_list/{emp_id}` | **POST** a new row when a person signs up in the app and has confirmed their number by SMS code. **PUT** `emp_name`, `emp_lname`, `emp_age` when the user edits their profile. **PUT** `status = 'Cancel'` when the user deletes their account. |
| `doctor_list` | Active counsellors. Only these columns reach the screen: name, city name, experience, `doc_category`, description and photo file name. | none |
| `booking_appointment` | The user's own bookings (`customer_id = emp_id`), plus every counsellor's bookings so taken slots can be hidden | **POST** a new booking, in the same format the website uses. **PUT** `status = 'Cancel'`, `canceledby = 'User'` and `reason` when the user cancels. |
| `doctor_category` | not used yet | none |

### New accounts are created by the app
1. **Get Started** collects the person's name, mobile number, email, and company and employee ID for corporate users.
2. The app sends a 6-digit code to that number by SMS. Nothing is written yet.
3. When the person enters the code, the app adds them to `employee_list` and signs them in.
4. WhatsApp then opens to **+91 72005 00221** with the same details filled in, so the team knows who joined. The person still has to tap Send there.

The new row has `status = Active`, the 10-digit `emp_mobile`, `emp_name`, `emp_lname`, `emp_email` and `emp_option` (`Corporate` or `Individual`). For corporate users the company goes in `emp_organisationname`. `emp_familyoption` is `Self`, `position` is `0`, and `reg_date`, `created_at` and `updated_at` use the same formats as existing rows. Every other column is an empty string.

Rules:
- A number that already has an active account is told to sign in instead.
- A number the team has set to `DeActive` or `Cancel` can't sign up again.
- Names and company are stripped of `<`, `>` and control characters before they are stored.
- If the connection drops while the account is being created, entering the code again finishes the job without adding a second row.
- The employee ID has no column in `employee_list`, so it is only in the WhatsApp message.

**The account is active straight away.** Nobody at CecureUs approves it first, and the app doesn't check that a corporate user really works at the company they typed. The WhatsApp message is how the team finds out; if someone shouldn't have access, set their `status` to `DeActive`.

### Sign-in uses the mobile number and an SMS code
1. The user enters their mobile number.
2. The app downloads `employee_list` and finds an `Active` row whose `emp_mobile` matches. It accepts `9876543210`, `91-9876543210`, `09876543210` and `98765 43210`.
3. It sends a random 6-digit code by SMS. The code is kept only in the app's memory and is never written to `emp_otp`.
4. The rules:
   - codes expire after 10 minutes
   - the user must wait 60 seconds before asking for a new code
   - a code locks after 5 wrong tries
   - at most 5 SMS per number per hour
5. The session lasts 30 days. If the team sets the account to `DeActive` or `Cancel`, the user is signed out the next time the app checks the account (within about a minute of use).

Numbers that are not in the table, or not active, never get an SMS.

### Bookings
- **Time slots:** one hour each, 10:00 AM to 9:00 PM IST, every day. Slots that start within the next hour, and slots that overlap an existing booking for that counsellor, are hidden. `doctor_timelist` is not one of the allowed tables, so each counsellor's real hours can't be used yet.
- **Session types:** audio (`connectoption = voice`) and video (`Video Call`). These are the only values in the existing data.
- **Status shown in the app:**
  - empty `status` → "Awaiting confirmation"
  - once a `join_url` is added → "Confirmed", with a Join button
  - `Completed` / `Unattended` → past session
  - `Cancel` → cancelled
- **Retries:** if the network drops after booking, the retry finds the same booking instead of creating a second one.
- **Double booking:** if two people book the same slot at the same moment, the earlier row is kept and the later one is cancelled automatically. This is needed because the table has no transactions.

### SMS Integra
The app generates the code and sends it through SMS Integra. Set `EXPO_PUBLIC_SMS_URL_TEMPLATE` to:

```
https://www.smsintegra.com/api/smsapi.aspx?uid=UID&pwd=PWD&mobile={mobile91}&msg={message}&sid=SID&type=0&dtTimeNow={date}&entityid=ENTITYID&tempid=TEMPID
```

Replace `UID`, `PWD`, `SID`, `ENTITYID` and `TEMPID` with the account's values. Leave the placeholders as they are:
- `{mobile}`: 10 digits
- `{mobile91}`: 91 followed by the 10 digits
- `{message}`: the text, URL-encoded
- `{otp}`: the code on its own
- `{date}`: the current date and time in IST

`EXPO_PUBLIC_SMS_MESSAGE` must match the DLT-approved template for that `tempid` exactly, with `{otp}` where the code goes.

SMS Integra answers "200 OK" even when it refuses a message (for example `91 - Invalid Template ID`). The app reads the reply and treats those as failures, so the user sees "could not send the code" instead of waiting for an SMS that never comes.

In development, if no URL is set, the code is printed in the Metro terminal instead.

## Protections built into the app

These are enforced in [`table-api.ts`](../src/api/table-backend/table-api.ts), the only file that talks to the table API:

- **Four tables only.** A request for any other table is refused before it reaches the network.
- **Sensitive columns are dropped on arrival.** Each table has a short list of columns the app keeps. Passwords, OTPs, bank and PAN details, counsellor phone and email, and Zoom host links are discarded as soon as a response is parsed, so they never sit in memory, caches or logs.
- **Row ids must be plain numbers.** Anything else is never put into a URL.
- **A lookup by id only accepts that row.** If the server returns a different row, it is ignored.
- **Updates can't change a row's primary key.**
- **HTTPS only**, checked when the app starts.

### Rate limits
The limits are kept in the phone's keystore, so closing and reopening the app does not reset them.

| What | Limit |
|---|---|
| SMS codes to one number | 1 per 60 seconds, 5 per hour |
| SMS codes from one device, any numbers | 8 per hour, 20 per day |
| Wrong codes for one request | 5, then a new code is needed |
| Wrong codes from one device | 10 in 15 minutes, then code entry is paused |
| Bookings | 5 per hour |
| Cancellations | 10 per hour |
| Profile edits | 10 per hour |
| New accounts from one device | 3 per day |
| Account deletion requests | 3 per day |

Text a person types (names, company, booking notes, cancellation reason) has `<`, `>` and control characters removed before it is stored.

These limits stop ordinary misuse from the real app. They can't stop someone who calls the table API or the SMS gateway directly; only the server can.

The app also writes as little as possible: three profile columns, the account status, new bookings, and booking cancellations. It never calls DELETE.

## Limits of this setup (please read)

These come from using a public table API directly from the app. **No app code can fix them; they need the server.**

1. **The table API has no login.** Anyone who has the URL can read all 4,528 employee rows, including `emp_password` and `emp_otp`, and all counsellor bank and PAN details. They can also change or delete rows. Simply having the app doesn't make this worse, because the URL is public anyway.
2. **The OTP is checked on the phone.** A determined attacker who modifies the app could skip the check and act as any employee: see their bookings, book or cancel. The rules above stop ordinary misuse, but they aren't enforced by a server.
3. **The SMS key is inside the app.** `EXPO_PUBLIC_SMS_URL_TEMPLATE` is compiled into the APK and can be pulled out of it, then used to send SMS on CecureUs credits.
4. **Sign-in downloads all of `employee_list` (about 3 MB).** The API ignores filters, so this is unavoidable for now. It works, but it's slow on weak networks.

### Fix: two PHP endpoints on the CecureUs server
Adding these to the existing PHP code removes limits 2–4. The app already speaks this format, so you'd only need to set `EXPO_PUBLIC_BACKEND=api`.

```
POST /api/mobile/v1/auth/otp/request   {"mobile":"+919876543210"}
  → 200 {"status":true,"data":{"requestId":"…","expiresInSeconds":600,"resendAfterSeconds":60}}
  → 422 {"status":false,"code":"NOT_REGISTERED"|"ACCOUNT_INACTIVE"|"INVALID_MOBILE","message":"…"}
  → 429 {"status":false,"code":"OTP_COOLDOWN"|"OTP_LIMIT"}  + Retry-After header

POST /api/mobile/v1/auth/otp/verify    {"requestId":"…","otp":"123456"}
  → 200 {"status":true,"data":{"accessToken":"…","expiresAt":"2026-12-01T00:00:00Z","user":{…}}}
  → 422 {"status":false,"code":"OTP_INVALID"|"OTP_EXPIRED"}   429 {"code":"OTP_LOCKED"}
```

The server should:
- generate the code with `random_int`
- store a hash of it, never the code itself
- send the SMS with the key kept on the server
- issue a random token

After that, the server should require that token on the other `/api/mobile/v1/*` endpoints and **switch off public access to `/api/{table}`**. Even just requiring a secret header closes the open data problem in limit 1.

## Open questions for CecureUs
- **Counsellor photos:** where are the `doct_image` files served from? Every path we tried under `eap.cecureus.com` returns HTML. Until we know, the app shows initials. When you know the path, set `EXPO_PUBLIC_MEDIA_BASE_URL`.
- **Extra read-only tables:** can you allow `doctor_timelist` (real hours), `doct_language` (languages each counsellor speaks) and `issuse_list` (the official list of issues)?
- **Account deletion:** is `status = 'Cancel'` the right marker for "user asked to delete their account"?
- **Articles, videos and self-assessments:** no tables are allowed for these, so those screens show empty states.
