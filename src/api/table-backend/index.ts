/**
 * "Table backend": implements the app's API (docs/API_CONTRACT.md paths) on the device, on top of
 * the CecureUs table API (/api/{table}[/{id}], GET/POST/PUT/DELETE only).
 *
 * It plugs in as the API client's `fetch`, so screens, schemas and tests are unchanged. When the
 * CecureUs server implements these endpoints itself, set EXPO_PUBLIC_BACKEND=api and this module
 * is no longer used. See docs/TABLE_BACKEND.md for the rules it enforces and its limits.
 *
 * Tables used:
 *   employee_list        read (sign-in lookup, profile) · PUT (profile edit, deletion request)
 *   doctor_list          read only (sanitised counsellor directory)
 *   booking_appointment  read · POST (book) · PUT (cancel)
 * New accounts are NOT created here — sign-up requests go to the CecureUs team on WhatsApp.
 */
import { getRandomValues, randomUUID } from 'expo-crypto';

import { readJson, writeJson } from '@/local/secure-json-store';

import {
  bookingMinutes,
  expertiseOf,
  isActiveDoctor,
  isActiveEmployee,
  isCancelledBooking,
  newBookingRow,
  normalizeDbMobile,
  overlaps,
  str,
  toBooking,
  toCounsellor,
  toUser,
  type Row,
} from './mapping';
import { sendOtpSms, SmsError, type SmsConfig } from './sms';
import { createTableApi, insertedId, TableApiError } from './table-api';
import { addDaysYmd, isoToIst, istToIso, isYmd, IST_TIMEZONE, legacyTimestamp } from './time';

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
/** SMS cost protection: at most this many codes per number per hour. */
export const OTP_MAX_PER_HOUR = 5;
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
export const PAGE_SIZE = 10;
/** Bookable hours in IST: first slot 10:00 AM, last slot 8:00–9:00 PM (matches existing bookings). */
export const DEFAULT_SLOT_HOURS = { start: 10, end: 21 };
export const SLOT_MINUTES = 60;
/** Slots starting sooner than this are not offered. */
export const BOOKING_LEAD_MS = 60 * 60 * 1000;
const MAX_AVAILABILITY_DAYS = 31;

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Marathi', 'Gujarati'];

type Session = { empId: string; expiresAt: number };
type Sessions = Record<string, Session>;

export type SessionStorage = { read(): Promise<Sessions>; write(sessions: Sessions): Promise<void> };

export type TableBackendOptions = {
  /** Base URL the API client is configured with (requests are matched relative to it). */
  baseUrl: string;
  /** e.g. https://eap.cecureus.com/api */
  tableApiUrl: string;
  sms: SmsConfig;
  /** Network for the table API and SMS gateway (defaults to global fetch). */
  fetchImpl?: typeof fetch;
  sessionStorage?: SessionStorage;
  now?: () => number;
  generateOtp?: () => string;
  generateToken?: () => string;
  slotHours?: { start: number; end: number };
};

type Result = { status: number; body: unknown; retryAfter?: number };
const ok = (data: unknown, status = 200): Result => ({ status, body: { status: true, data } });
const fail = (status: number, message: string, code: string, retryAfter?: number): Result => ({
  status,
  body: { status: false, message, code },
  retryAfter,
});

function secureOtp(): string {
  const [n] = getRandomValues(new Uint32Array(1));
  return String(n % 1_000_000).padStart(6, '0');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function defaultSessionStorage(): SessionStorage {
  const KEY = 'cecureus.table.sessions.v1';
  return {
    read: () => readJson<Sessions>(KEY, {}),
    write: (sessions) => writeJson(KEY, sessions),
  };
}

export function createTableBackend(opts: TableBackendOptions) {
  const now = opts.now ?? (() => Date.now());
  const generateOtp = opts.generateOtp ?? secureOtp;
  const generateToken = opts.generateToken ?? (() => `${randomUUID()}${randomUUID()}`.replace(/-/g, ''));
  const hours = opts.slotHours ?? DEFAULT_SLOT_HOURS;
  const storage = opts.sessionStorage ?? defaultSessionStorage();
  const net: typeof fetch = (i, init) => (opts.fetchImpl ?? globalThis.fetch)(i, init);
  const tables = createTableApi({ baseUrl: opts.tableApiUrl, fetchImpl: net });

  // ---- in-memory state (OTP codes never leave memory and are never written to the tables) ----
  const otps = new Map<string, { empId: string; mobile: string; code: string; issuedAt: number; attempts: number }>();
  const smsSent = new Map<string, number[]>();
  let sessions: Sessions | null = null;

  async function loadSessions(): Promise<Sessions> {
    if (!sessions) sessions = await storage.read().catch(() => ({}));
    return sessions;
  }
  async function saveSessions() {
    if (sessions) await storage.write(sessions).catch(() => undefined);
  }

  // ---- short read cache so screens don't re-download whole tables on every render ----
  const cache = new Map<string, { at: number; rows: Row[] }>();
  async function cachedList(table: 'doctor_list' | 'booking_appointment', ttlMs: number, signal?: AbortSignal) {
    const hit = cache.get(table);
    if (hit && now() - hit.at < ttlMs) return hit.rows;
    const rows = await tables.list(table, signal);
    cache.set(table, { at: now(), rows });
    return rows;
  }
  const doctors = (signal?: AbortSignal) => cachedList('doctor_list', 5 * 60 * 1000, signal);
  const bookingsCached = (signal?: AbortSignal) => cachedList('booking_appointment', 30 * 1000, signal);
  async function bookingsFresh(signal?: AbortSignal) {
    cache.delete('booking_appointment');
    return bookingsCached(signal);
  }
  const employeeCache = new Map<string, { at: number; row: Row | null }>();
  async function employee(id: string, signal?: AbortSignal, fresh = false) {
    const hit = employeeCache.get(id);
    if (!fresh && hit && now() - hit.at < 60 * 1000) return hit.row;
    const row = await tables.get('employee_list', id, signal);
    employeeCache.set(id, { at: now(), row });
    return row;
  }

  async function openSession(row: Row) {
    const all = await loadSessions();
    for (const [t, s] of Object.entries(all)) if (s.expiresAt <= now()) delete all[t];
    const token = generateToken();
    const expiresAt = now() + SESSION_TTL_MS;
    all[token] = { empId: str(row.emp_id), expiresAt };
    await saveSessions();
    return { accessToken: token, expiresAt: new Date(expiresAt).toISOString(), user: toUser(row) };
  }

  async function dropSessionsFor(empId: string) {
    const all = await loadSessions();
    for (const [t, s] of Object.entries(all)) if (s.empId === empId) delete all[t];
    await saveSessions();
  }

  // ---------------- routes ----------------

  async function requestOtp(body: Row, signal?: AbortSignal): Promise<Result> {
    const mobile = normalizeDbMobile(body.mobile);
    if (!mobile) return fail(422, 'Enter a valid 10-digit Indian mobile number.', 'INVALID_MOBILE');

    const t = now();
    const sent = (smsSent.get(mobile) ?? []).filter((at) => t - at < 3600 * 1000);
    const last = sent[sent.length - 1];
    if (last !== undefined && t - last < OTP_RESEND_MS) {
      const wait = Math.ceil((OTP_RESEND_MS - (t - last)) / 1000);
      return fail(429, 'Please wait before requesting another code.', 'OTP_COOLDOWN', wait);
    }
    if (sent.length >= OTP_MAX_PER_HOUR) {
      const wait = Math.ceil((3600 * 1000 - (t - sent[0])) / 1000);
      return fail(429, 'Too many codes requested. Please try again later.', 'OTP_LIMIT', wait);
    }

    // Always read fresh: the team may have just added or activated this person.
    const matches = (await tables.list('employee_list', signal)).filter((r) => normalizeDbMobile(r.emp_mobile) === mobile);
    const active = matches.filter(isActiveEmployee).sort((a, b) => Number(b.emp_id) - Number(a.emp_id));
    if (!matches.length) {
      return fail(422, 'This number is not registered with CecureUs yet.', 'NOT_REGISTERED');
    }
    if (!active.length) {
      return fail(
        422,
        'Your account is not active. Please contact CecureUs at connect@cecureus.com.',
        'ACCOUNT_INACTIVE',
      );
    }

    const code = generateOtp();
    try {
      await sendOtpSms(opts.sms, mobile, code, net);
    } catch (e) {
      if (e instanceof SmsError) {
        return fail(503, 'We could not send the code right now. Please try again shortly.', e.code);
      }
      throw e;
    }
    for (const [id, o] of otps) if (o.mobile === mobile) otps.delete(id);
    const requestId = generateToken();
    otps.set(requestId, { empId: str(active[0].emp_id), mobile, code, issuedAt: t, attempts: 0 });
    smsSent.set(mobile, [...sent, t]);
    return ok({ requestId, expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_MS / 1000 });
  }

  async function verifyOtp(body: Row, signal?: AbortSignal): Promise<Result> {
    const entry = otps.get(str(body.requestId));
    if (!entry) return fail(422, 'This code is not valid. Please request a new one.', 'OTP_INVALID');
    if (now() - entry.issuedAt > OTP_TTL_MS) {
      otps.delete(str(body.requestId));
      return fail(422, 'This code has expired. Request a new one.', 'OTP_EXPIRED');
    }
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      return fail(429, 'Too many incorrect attempts. Request a new code.', 'OTP_LOCKED');
    }
    if (!constantTimeEqual(entry.code, str(body.otp))) {
      entry.attempts += 1;
      return fail(422, 'Incorrect code. Please try again.', 'OTP_INVALID');
    }
    otps.delete(str(body.requestId));
    const row = await employee(entry.empId, signal, true);
    if (!row || !isActiveEmployee(row)) {
      return fail(422, 'Your account is not active. Please contact CecureUs at connect@cecureus.com.', 'ACCOUNT_INACTIVE');
    }
    return ok(await openSession(row));
  }

  async function authUser(headers: Record<string, string>, signal?: AbortSignal) {
    const token = (headers.Authorization ?? headers.authorization ?? '').replace(/^Bearer /, '');
    const all = await loadSessions();
    const session = token ? all[token] : undefined;
    if (!session || session.expiresAt <= now()) return null;
    const row = await employee(session.empId, signal);
    if (!row || !isActiveEmployee(row)) {
      // Deactivated by the CecureUs team → sign out everywhere.
      await dropSessionsFor(session.empId);
      return null;
    }
    return { row, token };
  }

  async function availableSlots(doctorId: string, from: string, to: string, signal?: AbortSignal) {
    const booked = (await bookingsFresh(signal))
      .filter((b) => str(b.doc_id) === doctorId && !isCancelledBooking(b))
      .map((b) => ({ date: str(b.booknewdate), minutes: bookingMinutes(b) }))
      .filter((b): b is { date: string; minutes: { start: number; end: number } } => !!b.minutes);
    const earliest = now() + BOOKING_LEAD_MS;
    const days: { date: string; slots: { start: string; end: string }[] }[] = [];
    for (let i = 0, date = from; date <= to && i < MAX_AVAILABILITY_DAYS; i++, date = addDaysYmd(from, i)) {
      const slots: { start: string; end: string }[] = [];
      for (let h = hours.start; h < hours.end; h++) {
        const slot = { start: h * 60, end: h * 60 + SLOT_MINUTES };
        if (Date.parse(istToIso(date, slot.start)) <= earliest) continue;
        if (booked.some((b) => b.date === date && overlaps(b.minutes, slot))) continue;
        slots.push({ start: istToIso(date, slot.start), end: istToIso(date, slot.end) });
      }
      days.push({ date, slots });
    }
    return days;
  }

  async function createBooking(user: Row, body: Row, signal?: AbortSignal): Promise<Result> {
    const doctor = (await doctors(signal)).find((d) => str(d.doc_id) === str(body.counsellorId) && isActiveDoctor(d));
    if (!doctor) return fail(404, 'This counsellor is no longer available.', 'NOT_FOUND');
    const mode = str(body.mode);
    if (!['audio', 'video'].includes(mode)) return fail(422, 'Choose an audio or video session.', 'INVALID_MODE');
    const slot = isoToIst(str(body.slotStart));
    if (
      !slot ||
      slot.minutes % SLOT_MINUTES !== 0 ||
      slot.minutes < hours.start * 60 ||
      slot.minutes >= hours.end * 60 ||
      Date.parse(str(body.slotStart)) <= now() + BOOKING_LEAD_MS
    ) {
      return fail(409, 'This time slot is no longer available. Please choose another.', 'SLOT_UNAVAILABLE');
    }
    const minutes = { start: slot.minutes, end: slot.minutes + SLOT_MINUTES };
    const customerId = str(user.emp_id);
    const docId = str(doctor.doc_id);
    const sameSlot = (b: Row) => {
      const m = bookingMinutes(b);
      return str(b.doc_id) === docId && str(b.booknewdate) === slot.ymd && !isCancelledBooking(b) && !!m && overlaps(m, minutes);
    };
    const mine = (b: Row) => sameSlot(b) && str(b.customer_id) === customerId;

    const existing = await bookingsFresh(signal);
    // A retry after a lost response finds the booking it already made instead of booking twice.
    const replay = existing.find(mine);
    if (replay) return ok(toBooking(replay, now()));
    if (existing.some(sameSlot)) {
      return fail(409, 'This time slot is no longer available. Please choose another.', 'SLOT_UNAVAILABLE');
    }

    const issue = str(body.issueId) || null;
    const response = await tables.create(
      'booking_appointment',
      newBookingRow({
        customerId,
        doctor,
        ymd: slot.ymd,
        startMinutes: minutes.start,
        durationMinutes: SLOT_MINUTES,
        mode,
        issue,
        language: str(body.language) || null,
        notes: str(body.notes).slice(0, 500) || null,
        timestamp: legacyTimestamp(now()),
      }),
      signal,
    );

    // Find the stored row (by returned id if the server sends one, otherwise by its content).
    const after = await bookingsFresh(signal);
    const id = insertedId(response, 'book_id');
    const created =
      (id && after.find((b) => str(b.book_id) === id)) ||
      after.filter(mine).sort((a, b) => Number(b.book_id) - Number(a.book_id))[0];
    if (!created) throw new TableApiError('Booking was not found after insert');

    // The table has no transactions: if someone else booked the same slot at the same moment,
    // the earlier row wins and this one is cancelled.
    const rival = after.find((b) => sameSlot(b) && Number(b.book_id) < Number(created.book_id) && str(b.customer_id) !== customerId);
    if (rival) {
      await tables.update(
        'booking_appointment',
        str(created.book_id),
        { status: 'Cancel', canceledby: 'User', reason: 'Slot already taken', updated_at: legacyTimestamp(now()) },
        signal,
      );
      cache.delete('booking_appointment');
      return fail(409, 'This time slot is no longer available. Please choose another.', 'SLOT_UNAVAILABLE');
    }
    const booking = toBooking(created, now());
    if (!booking) throw new TableApiError('Stored booking could not be read');
    return ok(booking, 201);
  }

  async function route(
    method: string,
    path: string,
    query: URLSearchParams,
    headers: Record<string, string>,
    body: Row,
    signal?: AbortSignal,
  ): Promise<Result> {
    if (method === 'POST' && path === 'auth/otp/request') return requestOtp(body, signal);
    if (method === 'POST' && path === 'auth/otp/verify') return verifyOtp(body, signal);

    if (method === 'GET' && path === 'issues') {
      const names = new Set<string>();
      (await doctors(signal)).filter(isActiveDoctor).forEach((d) => expertiseOf(d).forEach((n) => names.add(n)));
      return ok([...names].sort((a, b) => a.localeCompare(b)).map((name) => ({ id: name, name })));
    }
    if (method === 'GET' && path === 'languages') return ok(LANGUAGES.map((name) => ({ id: name, name })));

    const auth = await authUser(headers, signal);
    if (!auth) return fail(401, 'Session expired', 'UNAUTHENTICATED');
    const user = auth.row;
    const empId = str(user.emp_id);

    if (method === 'POST' && path === 'auth/logout') {
      const all = await loadSessions();
      delete all[auth.token];
      await saveSessions();
      return ok(null);
    }

    // ---- profile ----
    if (method === 'GET' && path === 'me') return ok(toUser(user));
    if (method === 'PATCH' && path === 'me') {
      const firstName = str(body.firstName);
      const lastName = str(body.lastName);
      const age = body.age;
      if (!firstName) return fail(422, 'First name is required.', 'VALIDATION');
      if (age !== null && age !== undefined && (!Number.isInteger(age) || (age as number) < 18 || (age as number) > 100)) {
        return fail(422, 'Enter an age between 18 and 100.', 'INVALID_AGE');
      }
      const patch = {
        emp_name: firstName,
        emp_lname: lastName,
        emp_age: age === null || age === undefined ? '' : String(age),
        updated_at: legacyTimestamp(now()),
      };
      await tables.update('employee_list', empId, patch, signal);
      const updated = { ...user, ...patch };
      employeeCache.set(empId, { at: now(), row: updated });
      return ok(toUser(updated));
    }
    if (method === 'DELETE' && path === 'me') {
      // Deletion request: the account is switched off immediately; the team removes the data.
      await tables.update('employee_list', empId, { status: 'Cancel', updated_at: legacyTimestamp(now()) }, signal);
      employeeCache.delete(empId);
      await dropSessionsFor(empId);
      return ok(null);
    }

    // ---- counsellors ----
    if (method === 'GET' && path === 'counsellors') {
      const search = (query.get('search') ?? '').trim().toLowerCase();
      const expertise = (query.get('expertise') ?? '').trim().toLowerCase();
      const page = Math.max(1, Number(query.get('page')) || 1);
      const list = (await doctors(signal)).filter(isActiveDoctor).filter((d) => {
        const tags = expertiseOf(d).map((t) => t.toLowerCase());
        if (expertise && !tags.some((t) => t.includes(expertise))) return false;
        if (!search) return true;
        return [str(d.doc_name), str(d.doc_cityname), str(d.doc_category), str(d.doc_description)]
          .join(' ')
          .toLowerCase()
          .includes(search);
      });
      const completed = await completedCounts(signal);
      const items = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((d) => toCounsellor(d, completed.get(str(d.doc_id)) ?? null));
      return ok({ items, nextPage: page * PAGE_SIZE < list.length ? page + 1 : null });
    }
    let m = path.match(/^counsellors\/([^/]+)$/);
    if (method === 'GET' && m) {
      const d = (await doctors(signal)).find((x) => str(x.doc_id) === decodeURIComponent(m![1]) && isActiveDoctor(x));
      if (!d) return fail(404, 'Not found', 'NOT_FOUND');
      const completed = await completedCounts(signal);
      return ok(toCounsellor(d, completed.get(str(d.doc_id)) ?? null));
    }
    m = path.match(/^counsellors\/([^/]+)\/availability$/);
    if (method === 'GET' && m) {
      const id = decodeURIComponent(m[1]);
      if (!(await doctors(signal)).some((x) => str(x.doc_id) === id && isActiveDoctor(x))) {
        return fail(404, 'Not found', 'NOT_FOUND');
      }
      const from = query.get('from') ?? '';
      const to = query.get('to') ?? '';
      if (!isYmd(from) || !isYmd(to) || to < from) return fail(422, 'Invalid date range.', 'VALIDATION');
      return ok({ timezone: IST_TIMEZONE, days: await availableSlots(id, from, to, signal) });
    }

    // ---- bookings ----
    if (method === 'POST' && path === 'bookings') return createBooking(user, body, signal);
    if (method === 'GET' && path === 'bookings') {
      const items = (await bookingsFresh(signal))
        .filter((b) => str(b.customer_id) === empId)
        .map((b) => toBooking(b, now()))
        .filter((b): b is NonNullable<typeof b> => !!b)
        .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
      return ok({ items, nextPage: null });
    }
    m = path.match(/^bookings\/([^/]+)\/cancel$/);
    if (method === 'POST' && m) {
      const row = await tables.get('booking_appointment', decodeURIComponent(m[1]), signal);
      if (!row || str(row.customer_id) !== empId) return fail(404, 'Booking not found', 'NOT_FOUND');
      const booking = toBooking(row, now());
      if (!booking?.cancellable) return fail(409, 'This session can no longer be cancelled.', 'NOT_CANCELLABLE');
      const patch = {
        status: 'Cancel',
        canceledby: 'User',
        reason: str(body.reason).slice(0, 250),
        updated_at: legacyTimestamp(now()),
      };
      await tables.update('booking_appointment', str(row.book_id), patch, signal);
      cache.delete('booking_appointment');
      return ok(toBooking({ ...row, ...patch }, now()));
    }

    // ---- content: no article/video/assessment tables are available yet → honest empty states ----
    if (method === 'GET' && (path === 'articles' || path === 'videos')) return ok({ items: [], nextPage: null });
    if (method === 'GET' && path === 'assessments') return ok([]);
    if (method === 'GET' && /^(articles|assessments)\/[^/]+$/.test(path)) return fail(404, 'Not found', 'NOT_FOUND');

    return fail(404, 'Not found', 'NOT_FOUND');
  }

  async function completedCounts(signal?: AbortSignal): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    try {
      for (const b of await bookingsCached(signal)) {
        if (str(b.status).toLowerCase() === 'completed') counts.set(str(b.doc_id), (counts.get(str(b.doc_id)) ?? 0) + 1);
      }
    } catch {
      // Session counts are decorative; the directory still loads without them.
    }
    return counts;
  }

  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const base = new URL(opts.baseUrl);
    const path = url.pathname.slice(base.pathname.replace(/\/+$/, '').length).replace(/^\/+/, '');
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = (init.headers ?? {}) as Record<string, string>;
    let body: Row = {};
    try {
      body = init.body ? (JSON.parse(String(init.body)) as Row) : {};
    } catch {
      body = {};
    }
    let result: Result;
    try {
      result = await route(method, path, url.searchParams, headers, body, init.signal ?? undefined);
    } catch (e) {
      // Offline / timeout / cancel: rethrow so the API client reports it accurately.
      if (!(e instanceof TableApiError)) throw e;
      result = fail(502, 'Something went wrong on our side. Please try again shortly.', 'UPSTREAM_ERROR');
    }
    const responseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (result.retryAfter) responseHeaders['Retry-After'] = String(result.retryAfter);
    return new Response(JSON.stringify(result.body), { status: result.status, headers: responseHeaders });
  }) as typeof fetch;

  return { fetch: fetchImpl };
}

export type TableBackend = ReturnType<typeof createTableBackend>;
