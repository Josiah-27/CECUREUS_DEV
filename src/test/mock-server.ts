/**
 * Deterministic in-memory implementation of the PROPOSED CecureUs mobile API
 * (docs/API_CONTRACT.md). Used only by tests — it never touches a real backend.
 * It doubles as an executable spec of the server-side rules the backend must enforce.
 */

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const ADMIN_SMS_NUMBER = '+917200500221';

type Json = Record<string, unknown> | unknown[] | null;

/**
 * One row of the existing MySQL `employee_list` table — exact column names, all values as
 * strings (the columns are varchar), except the int primary key. No columns are added.
 */
export type EmployeeRow = {
  emp_id: number;
  emp_otp: string;
  emp_companyname: string;
  emp_name: string;
  emp_lname: string;
  emp_companyid: string;
  emp_email: string;
  emp_password: string;
  emp_mobile: string;
  emp_familyoption: string;
  emp_dob: string;
  emp_age: string;
  emp_gender: string;
  emp_country: string;
  emp_option: string;
  emp_location: string;
  emp_jobtitle: string;
  emp_department: string;
  emp_doj: string;
  emp_agree: string;
  emp_organisationname: string;
  emp_maritalstatus: string;
  emp_emargenumber: string;
  plan_date: string;
  reg_date: string;
  emp_role: string;
  created_at: string;
  updated_at: string;
  status: string;
  position: string;
};

/** Column list of `employee_list` from ryvvtjmw_cecureus_staging.sql, in table order. */
export const EMPLOYEE_LIST_COLUMNS = [
  'emp_id', 'emp_otp', 'emp_companyname', 'emp_name', 'emp_lname', 'emp_companyid', 'emp_email', 'emp_password',
  'emp_mobile', 'emp_familyoption', 'emp_dob', 'emp_age', 'emp_gender', 'emp_country', 'emp_option', 'emp_location',
  'emp_jobtitle', 'emp_department', 'emp_doj', 'emp_agree', 'emp_organisationname', 'emp_maritalstatus',
  'emp_emargenumber', 'plan_date', 'reg_date', 'emp_role', 'created_at', 'updated_at', 'status', 'position',
] as const;

/** Organisations registered with CecureUs in the mock (work-email domain → company). */
export const REGISTERED_ORGANISATIONS: Record<string, { name: string; sessionsPerYear: number }> = {
  'fixturecorp.com': { name: 'Fixture Corp', sessionsPerYear: 6 },
  'democorp.com': { name: 'Demo Corp', sessionsPerYear: 8 },
};

/** Demo account seeded in demo mode so "I already have an account" works immediately. */
export const DEMO_ACCOUNT = {
  email: 'harsha.verma@example.com',
  mobile: '+919876543210',
  /** The mock always sends this code. */
  otp: '123456',
};

/** Legacy DB date format seen in the dump, e.g. "25-05-2021 11:54:45 AM". */
function dbDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  const h = d.getHours() % 12 || 12;
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(h)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function normalizeMobile(value: unknown): string | null {
  const raw = String(value ?? '').replace(/[\s-]/g, '');
  const m = raw.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  return m ? `+91${m[1]}` : null;
}

function blankRow(emp_id: number, now: number): EmployeeRow {
  const row = Object.fromEntries(EMPLOYEE_LIST_COLUMNS.map((c) => [c, ''])) as unknown as EmployeeRow;
  return { ...row, emp_id, created_at: dbDate(now), updated_at: dbDate(now), status: 'pending' };
}

type OtpMeta = {
  requestId: string;
  empId: number;
  channel: 'email' | 'phone';
  target: string;
  issuedAt: number;
  attempts: number;
};

export type MockBooking = {
  id: string;
  customerId: number;
  counsellorId: string;
  counsellorName: string;
  start: string;
  end: string;
  mode: string;
  issue: string | null;
  language: string | null;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  joinUrl: string | null;
  cancellable: boolean;
  notification: { sms: 'sent' | 'queued' | 'failed' | 'not_required' };
};

export const fixtureCounsellors = [
  {
    id: '1',
    name: 'Test Counsellor One',
    title: 'Clinical Psychologist',
    city: 'Chennai',
    experienceYears: '8',
    languages: 'English, Tamil',
    expertise: 'Anxiety Management, Stress Management, Anxiety Management',
    about: 'Fixture counsellor used in automated tests.',
    imageUrl: null,
    rating: 4.9,
    sessionsCount: 412,
  },
  {
    id: '2',
    name: 'Test Counsellor Two',
    title: 'Counselling Psychologist',
    city: 'Mumbai',
    experienceYears: 6,
    languages: ['English', 'Hindi'],
    expertise: ['Workplace Stress', 'Burnout'],
    about: null,
    imageUrl: '1633080520fixture.png',
    rating: null,
    sessionsCount: null,
    modes: ['audio', 'video'],
  },
];

export type MockServerOptions = {
  now?: () => number;
  /** Force the SMS gateway to fail (booking must still be confirmed, notification marked failed). */
  smsFails?: boolean;
  /** API base URL the client uses; defaults to EXPO_PUBLIC_API_BASE_URL. */
  baseUrl?: string;
  /** Pre-create the demo account (demo mode / local preview). */
  seedDemoAccount?: boolean;
};

export type MockSnapshot = {
  employee_list: EmployeeRow[];
  sessions: [string, { empId: number; expiresAt: number }][];
  bookings: MockBooking[];
  idempotency: [string, MockBooking][];
  openSlots: string[];
  seq: number;
};

export function createMockServer(opts: MockServerOptions = {}) {
  const now = opts.now ?? (() => Date.now());
  const state = {
    /** The `employee_list` table. */
    employee_list: [] as EmployeeRow[],
    /** Server-side OTP bookkeeping (issue time / attempts); the code itself lives in employee_list.emp_otp. */
    otps: new Map<string, OtpMeta>(),
    sessions: new Map<string, { empId: number; expiresAt: number }>(),
    bookings: [] as MockBooking[],
    idempotency: new Map<string, MockBooking>(),
    smsLog: [] as { to: string; message: string }[],
    emailLog: [] as { to: string; message: string }[],
    deletionRequests: [] as string[],
    smsFails: opts.smsFails ?? false,
    seq: 0,
    /** Slots (ISO start) that the server reports as available. */
    openSlots: new Set<string>([
      '2026-11-02T04:30:00.000Z',
      '2026-11-02T05:30:00.000Z',
      '2026-11-03T09:00:00.000Z',
    ]),
    failNext: null as null | { status: number; body?: Json } | 'network',
    calls: [] as { url: string; method: string; path: string; headers: Record<string, string>; body: unknown }[],
  };

  const ok = (data: unknown, status = 200) => ({ status, body: { status: true, data } as Json });
  const fail = (status: number, message: string, code: string) => ({
    status,
    body: { status: false, message, code } as Json,
  });

  const nextEmpId = () => state.employee_list.reduce((max, r) => Math.max(max, r.emp_id), 100) + 1;
  const isActive = (r: EmployeeRow) => r.status.toLowerCase() === 'active';
  /** A sign-up whose SMS code has not been verified yet. */
  const SIGNUP_STATUS = 'Unverified';
  const isSignup = (r: EmployeeRow) => r.status === SIGNUP_STATUS;
  const activeRows = () => state.employee_list.filter(isActive);
  const touch = (row: EmployeeRow) => {
    row.updated_at = dbDate(now());
  };

  /** Maps an employee_list row to the API's User DTO (never exposes password/OTP). */
  function toUser(row: EmployeeRow) {
    const org = REGISTERED_ORGANISATIONS[row.emp_email.split('@')[1] ?? ''];
    return {
      id: String(row.emp_id),
      firstName: row.emp_name,
      lastName: row.emp_lname || null,
      email: row.emp_email,
      mobile: row.emp_mobile || null,
      userType: row.emp_option.toLowerCase() === 'corporate' ? 'corporate' : 'individual',
      companyName: row.emp_companyname || null,
      sessionsRemaining: row.emp_option.toLowerCase() === 'corporate' && org ? org.sessionsPerYear : null,
      age: row.emp_age ? Number(row.emp_age) : null,
    };
  }

  function openSession(row: EmployeeRow) {
    const token = `tok-${++state.seq}`;
    const expiresAt = now() + 30 * 24 * 3600 * 1000;
    state.sessions.set(token, { empId: row.emp_id, expiresAt });
    return { accessToken: token, expiresAt: new Date(expiresAt).toISOString(), user: toUser(row) };
  }

  function issueOtp(row: EmployeeRow, channel: OtpMeta['channel'], target: string) {
    const last = [...state.otps.values()].find((o) => o.empId === row.emp_id && o.channel === channel && o.target === target);
    if (last && now() - last.issuedAt < OTP_RESEND_MS) {
      return {
        ...fail(429, 'Please wait before requesting another code.', 'OTP_COOLDOWN'),
        retryAfter: Math.ceil((OTP_RESEND_MS - (now() - last.issuedAt)) / 1000),
      };
    }
    for (const [id, o] of state.otps) if (o.empId === row.emp_id && o.channel === channel) state.otps.delete(id);
    const requestId = `otp-${row.emp_id}-${channel}-${++state.seq}`;
    row.emp_otp = '123456'; // Mock: fixed code. Real backend: random, hashed, never returned.
    touch(row);
    state.otps.set(requestId, { requestId, empId: row.emp_id, channel, target, issuedAt: now(), attempts: 0 });
    (channel === 'email' ? state.emailLog : state.smsLog).push({ to: target, message: 'Your CecureUs verification code' });
    return ok({ requestId, expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_MS / 1000 });
  }

  function checkOtp(requestId: unknown, otp: unknown, channel: OtpMeta['channel']) {
    const meta = state.otps.get(String(requestId));
    const row = meta && state.employee_list.find((r) => r.emp_id === meta.empId);
    if (!meta || !row || meta.channel !== channel) return { error: fail(422, 'This code is not valid.', 'OTP_INVALID') };
    if (now() - meta.issuedAt > OTP_TTL_MS) return { error: fail(422, 'This code has expired. Request a new one.', 'OTP_EXPIRED') };
    if (meta.attempts >= OTP_MAX_ATTEMPTS) return { error: fail(429, 'Too many incorrect attempts. Request a new code.', 'OTP_LOCKED') };
    if (row.emp_otp !== String(otp)) {
      meta.attempts += 1;
      return { error: fail(422, 'Incorrect code. Please try again.', 'OTP_INVALID') };
    }
    state.otps.delete(meta.requestId);
    row.emp_otp = '';
    touch(row);
    return { row };
  }

  /** Inserts an employee_list row, as the CecureUs team does after a WhatsApp sign-up request. */
  function addEmployee(fields: Partial<EmployeeRow> = {}): EmployeeRow {
    const row = blankRow(nextEmpId(), now());
    Object.assign(row, { emp_country: 'India', reg_date: dbDate(now()), status: 'Active' }, fields);
    state.employee_list.push(row);
    return row;
  }

  if (opts.seedDemoAccount) {
    addEmployee({
      emp_name: 'Harsha',
      emp_lname: 'Verma',
      emp_email: DEMO_ACCOUNT.email,
      emp_mobile: DEMO_ACCOUNT.mobile.replace(/^\+91/, ''),
      emp_age: '29',
      emp_option: 'Individual',
    });
  }

  function authUser(headers: Record<string, string>) {
    const token = headers.Authorization?.replace(/^Bearer /, '');
    const session = token ? state.sessions.get(token) : undefined;
    if (!session || session.expiresAt <= now()) return null;
    return activeRows().find((r) => r.emp_id === session.empId) ?? null;
  }

  function route(method: string, path: string, query: URLSearchParams, headers: Record<string, string>, body: any) {
    // ---- Sign in: mobile number → SMS code (accounts are created by the CecureUs team) ----
    if (method === 'POST' && path === 'auth/otp/request') {
      const mobile = normalizeMobile(body?.mobile);
      if (!mobile) return fail(422, 'Enter a valid 10-digit Indian mobile number.', 'INVALID_MOBILE');
      const matches = state.employee_list.filter((r) => normalizeMobile(r.emp_mobile) === mobile && !isSignup(r));
      if (!matches.length) return fail(422, 'This number is not registered with CecureUs yet.', 'NOT_REGISTERED');
      const row = matches.filter(isActive).sort((a, b) => b.emp_id - a.emp_id)[0];
      if (!row) {
        return fail(422, 'Your account is not active. Please contact CecureUs at connect@cecureus.com.', 'ACCOUNT_INACTIVE');
      }
      return issueOtp(row, 'phone', mobile);
    }
    // ---- Sign up: details + mobile number → SMS code → the account is created when the code is verified ----
    if (method === 'POST' && path === 'auth/register') {
      const mobile = normalizeMobile(body?.mobile);
      if (!mobile) return fail(422, 'Enter a valid 10-digit Indian mobile number.', 'INVALID_MOBILE');
      const firstName = String(body?.firstName ?? '').trim();
      const email = String(body?.email ?? '').trim().toLowerCase();
      const corporate = body?.userType === 'corporate';
      const company = corporate ? String(body?.companyName ?? '').trim() : '';
      if (!firstName) return fail(422, 'First name is required.', 'VALIDATION');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(422, 'Enter a valid email address.', 'VALIDATION');
      if (corporate && !company) return fail(422, 'Company name is required.', 'VALIDATION');
      const matches = state.employee_list.filter((r) => normalizeMobile(r.emp_mobile) === mobile);
      if (matches.some(isActive)) {
        return fail(409, 'This number already has a CecureUs account. Please sign in instead.', 'ALREADY_REGISTERED');
      }
      if (matches.some((r) => !isSignup(r))) {
        return fail(422, 'Your account is not active. Please contact CecureUs at connect@cecureus.com.', 'ACCOUNT_INACTIVE');
      }
      // Mock: the unverified sign-up is parked in a row that no one can sign in to until the code is verified.
      const row = matches[0] ?? addEmployee({ status: SIGNUP_STATUS });
      Object.assign(row, {
        emp_name: firstName,
        emp_lname: String(body?.lastName ?? '').trim(),
        emp_email: email,
        emp_mobile: mobile.replace(/^\+91/, ''),
        emp_option: corporate ? 'Corporate' : 'Individual',
        emp_companyname: company,
      });
      return issueOtp(row, 'phone', mobile);
    }
    if (method === 'POST' && path === 'auth/otp/verify') {
      const result = checkOtp(body?.requestId, body?.otp, 'phone');
      if (result.error) return result.error;
      if (isSignup(result.row)) result.row.status = 'Active';
      if (!isActive(result.row)) {
        return fail(422, 'Your account is not active. Please contact CecureUs at connect@cecureus.com.', 'ACCOUNT_INACTIVE');
      }
      return ok(openSession(result.row));
    }

    // Public reference data
    if (method === 'GET' && path === 'issues') return ok([{ id: 1, name: 'Stress' }, { id: 2, name: 'Anxiety' }]);
    if (method === 'GET' && path === 'languages') return ok([{ id: 1, name: 'English' }, { id: 2, name: 'Hindi' }]);

    const user = authUser(headers);
    if (!user) return fail(401, 'Session expired', 'UNAUTHENTICATED');

    if (method === 'POST' && path === 'auth/logout') {
      state.sessions.delete(headers.Authorization.replace(/^Bearer /, ''));
      return ok(null);
    }
    if (method === 'GET' && path === 'me') return ok(toUser(user));
    if (method === 'PATCH' && path === 'me') {
      if (!String(body?.firstName ?? '').trim()) return fail(422, 'First name is required.', 'VALIDATION');
      const age = body?.age;
      if (age !== null && age !== undefined && (!Number.isInteger(age) || age < 18 || age > 100)) {
        return fail(422, 'Enter an age between 18 and 100.', 'INVALID_AGE');
      }
      Object.assign(user, {
        emp_name: String(body.firstName).trim(),
        emp_lname: String(body.lastName ?? '').trim(),
        emp_age: age === null || age === undefined ? '' : String(age),
      });
      touch(user);
      return ok(toUser(user));
    }
    if (method === 'DELETE' && path === 'me') {
      state.deletionRequests.push(user.emp_email);
      user.status = 'Cancel';
      for (const [token, sess] of state.sessions) if (sess.empId === user.emp_id) state.sessions.delete(token);
      return ok(null);
    }

    // ---- Counsellors ----
    if (method === 'GET' && path === 'counsellors') {
      const search = (query.get('search') ?? '').toLowerCase();
      const items = fixtureCounsellors.filter((c) => !search || JSON.stringify(c).toLowerCase().includes(search));
      return ok({ items, nextPage: null });
    }
    let m = path.match(/^counsellors\/([^/]+)$/);
    if (method === 'GET' && m) {
      const c = fixtureCounsellors.find((x) => x.id === m![1]);
      return c ? ok(c) : fail(404, 'Not found', 'NOT_FOUND');
    }
    m = path.match(/^counsellors\/([^/]+)\/availability$/);
    if (method === 'GET' && m) {
      const byDate = new Map<string, { start: string; end: string }[]>();
      [...state.openSlots].sort().forEach((start) => {
        const ist = new Date(Date.parse(start) + 330 * 60000).toISOString().slice(0, 10);
        const list = byDate.get(ist) ?? [];
        list.push({ start, end: new Date(Date.parse(start) + 3600000).toISOString() });
        byDate.set(ist, list);
      });
      return ok({ timezone: 'Asia/Kolkata', days: [...byDate].map(([date, slots]) => ({ date, slots })) });
    }

    // ---- Bookings ----
    if (method === 'POST' && path === 'bookings') {
      const key = headers['Idempotency-Key'];
      if (!key) return fail(400, 'Idempotency-Key header required', 'IDEMPOTENCY_KEY_REQUIRED');
      const replay = state.idempotency.get(`${user.emp_id}:${key}`);
      if (replay) return ok(replay, 200); // Same key → same booking, no second SMS.
      const counsellor = fixtureCounsellors.find((c) => c.id === String(body?.counsellorId));
      if (!counsellor) return fail(404, 'Counsellor not found', 'NOT_FOUND');
      if (!state.openSlots.has(String(body?.slotStart))) {
        return fail(409, 'This time slot is no longer available. Please choose another.', 'SLOT_UNAVAILABLE');
      }
      state.openSlots.delete(body.slotStart); // Atomic reservation.
      let sms: MockBooking['notification']['sms'] = 'sent';
      if (state.smsFails) sms = 'failed';
      else state.smsLog.push({ to: ADMIN_SMS_NUMBER, message: `New booking ${counsellor.name} ${body.slotStart}` });
      const booking: MockBooking = {
        id: `bk-${++state.seq}`, customerId: user.emp_id, counsellorId: counsellor.id, counsellorName: counsellor.name,
        start: body.slotStart, end: new Date(Date.parse(body.slotStart) + 3600000).toISOString(), mode: body.mode,
        issue: body.issueId ? 'Stress' : null, language: body.language ?? null, status: 'confirmed',
        joinUrl: body.mode === 'video' ? 'https://zoom.example/j/123' : null, cancellable: true,
        notification: { sms },
      };
      state.bookings.push(booking);
      state.idempotency.set(`${user.emp_id}:${key}`, booking);
      return ok(booking, 201);
    }
    if (method === 'GET' && path === 'bookings') {
      return ok({ items: state.bookings.filter((b) => b.customerId === user.emp_id), nextPage: null });
    }
    m = path.match(/^bookings\/([^/]+)\/cancel$/);
    if (method === 'POST' && m) {
      const b = state.bookings.find((x) => x.id === m![1] && x.customerId === user.emp_id);
      if (!b) return fail(404, 'Booking not found', 'NOT_FOUND');
      if (!b.cancellable) return fail(409, 'This session can no longer be cancelled.', 'NOT_CANCELLABLE');
      b.status = 'cancelled';
      b.cancellable = false;
      state.openSlots.add(b.start);
      return ok(b);
    }

    // ---- Content ----
    if (method === 'GET' && path === 'articles') {
      return ok({
        items: [
          { id: 1, title: '5 Signs You Might Be Overwhelmed', category: 'Stress', excerpt: 'Learn the signs.', readMinutes: 5 },
          { id: 2, title: 'How to Manage Anxiety at Work', category: 'Anxiety', readMinutes: '4' },
        ].filter((a) => !query.get('category') || a.category === query.get('category')),
        nextPage: query.get('page') ? null : 2,
      });
    }
    m = path.match(/^articles\/([^/]+)$/);
    if (method === 'GET' && m) {
      if (m[1] !== '1') return fail(404, 'Not found', 'NOT_FOUND');
      return ok({ id: 1, title: '5 Signs You Might Be Overwhelmed', category: 'Stress', contentHtml: '<p>First&nbsp;paragraph.</p><p>Second &amp; last.</p>' });
    }
    if (method === 'GET' && path === 'videos') {
      return ok({ items: [{ id: 'v1', title: 'Box Breathing', videoUrl: 'https://www.youtube.com/watch?v=fixture', durationSeconds: 180 }], nextPage: null });
    }

    // ---- Assessments ----
    if (method === 'GET' && path === 'assessments') {
      return ok([{ id: 1, title: 'Stress Level Check', description: 'Find out your stress levels', questionCount: 2, estimatedMinutes: 5 }]);
    }
    m = path.match(/^assessments\/([^/]+)$/);
    if (method === 'GET' && m) {
      return ok({
        id: 1, title: 'Stress Level Check',
        questions: [
          { id: 'q1', text: 'How often do you feel overwhelmed?', options: [{ id: 'a', text: 'Rarely' }, { id: 'b', text: 'Often' }] },
          { id: 'q2', text: 'How well do you sleep?', options: [{ id: 'c', text: 'Well' }, { id: 'd', text: 'Poorly' }] },
        ],
      });
    }
    m = path.match(/^assessments\/([^/]+)\/submit$/);
    if (method === 'POST' && m) {
      const answers = (body?.answers ?? []) as { optionId: string }[];
      if (answers.length !== 2) return fail(422, 'Please answer every question.', 'INCOMPLETE');
      const high = answers.filter((a) => a.optionId === 'b' || a.optionId === 'd').length;
      const percentage = high * 50;
      return ok({ percentage, level: percentage >= 50 ? 'Moderate' : 'Low', summary: 'Fixture result summary.' });
    }

    return fail(404, 'Not found', 'NOT_FOUND');
  }

  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const base = new URL(opts.baseUrl ?? process.env.EXPO_PUBLIC_API_BASE_URL!);
    const path = url.pathname.replace(base.pathname, '').replace(/^\/+/, '');
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    state.calls.push({ url: String(input), method, path, headers, body });

    if (init.signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const forced = state.failNext;
    state.failNext = null;
    if (forced === 'network') throw new TypeError('Network request failed');
    const result: { status: number; body?: Json; retryAfter?: number } = forced ?? route(method, path, url.searchParams, headers, body);
    const responseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (result.retryAfter) responseHeaders['Retry-After'] = String(result.retryAfter);
    return new Response(result.body === undefined ? '' : JSON.stringify(result.body), {
      status: result.status,
      headers: responseHeaders,
    });
  }) as typeof fetch;

  /** Persistent parts of the mock DB (used by demo mode to survive app reloads). */
  function snapshot(): MockSnapshot {
    return {
      employee_list: state.employee_list,
      sessions: [...state.sessions],
      bookings: state.bookings,
      idempotency: [...state.idempotency],
      openSlots: [...state.openSlots],
      seq: state.seq,
    };
  }

  function restore(snap: MockSnapshot) {
    state.employee_list = snap.employee_list;
    state.sessions = new Map(snap.sessions);
    state.bookings = snap.bookings;
    state.idempotency = new Map(snap.idempotency);
    state.openSlots = new Set(snap.openSlots);
    state.seq = snap.seq;
  }

  return { fetch: fetchImpl, state, snapshot, restore, addEmployee };
}

export type MockServer = ReturnType<typeof createMockServer>;
