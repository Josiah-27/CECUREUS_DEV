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

type OtpRecord = { requestId: string; email: string; code: string; issuedAt: number; attempts: number };

export type MockBooking = {
  id: string;
  userEmail: string;
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
};

export function createMockServer(opts: MockServerOptions = {}) {
  const now = opts.now ?? (() => Date.now());
  const state = {
    otps: new Map<string, OtpRecord>(),
    lastOtpByEmail: new Map<string, number>(),
    sessions: new Map<string, { email: string; expiresAt: number }>(),
    users: new Map<string, { id: string; firstName: string; lastName: string | null; email: string; mobile: string | null; userType: string; companyName: string | null; sessionsRemaining: number | null }>(),
    bookings: [] as MockBooking[],
    idempotency: new Map<string, MockBooking>(),
    smsLog: [] as { to: string; message: string }[],
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

  function authUser(headers: Record<string, string>) {
    const token = headers.Authorization?.replace(/^Bearer /, '');
    const session = token ? state.sessions.get(token) : undefined;
    if (!session || session.expiresAt <= now()) return null;
    return state.users.get(session.email) ?? null;
  }

  function route(method: string, path: string, query: URLSearchParams, headers: Record<string, string>, body: any) {
    // ---- Auth ----
    if (method === 'POST' && path === 'auth/otp/request') {
      const email = String(body?.email ?? '').toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(422, 'Enter a valid email address.', 'INVALID_EMAIL');
      const last = state.lastOtpByEmail.get(email);
      if (last && now() - last < OTP_RESEND_MS) {
        return { ...fail(429, 'Please wait before requesting another code.', 'OTP_COOLDOWN'), retryAfter: Math.ceil((OTP_RESEND_MS - (now() - last)) / 1000) };
      }
      const requestId = `req-${++state.seq}`;
      state.otps.set(requestId, { requestId, email, code: '123456', issuedAt: now(), attempts: 0 });
      state.lastOtpByEmail.set(email, now());
      if (!state.users.has(email)) {
        state.users.set(email, {
          id: String(100 + state.seq), firstName: 'Harsha', lastName: 'Verma', email, mobile: null,
          userType: body?.userType === 'corporate' ? 'corporate' : 'individual',
          companyName: body?.userType === 'corporate' ? 'Fixture Corp' : null,
          sessionsRemaining: body?.userType === 'corporate' ? 6 : null,
        });
      }
      return ok({ requestId, expiresInSeconds: OTP_TTL_MS / 1000, resendAfterSeconds: OTP_RESEND_MS / 1000 });
    }
    if (method === 'POST' && path === 'auth/otp/verify') {
      const rec = state.otps.get(String(body?.requestId));
      if (!rec || rec.email !== String(body?.email ?? '').toLowerCase()) return fail(422, 'This code is not valid.', 'OTP_INVALID');
      if (now() - rec.issuedAt > OTP_TTL_MS) return fail(422, 'This code has expired. Request a new one.', 'OTP_EXPIRED');
      if (rec.attempts >= OTP_MAX_ATTEMPTS) return fail(429, 'Too many incorrect attempts. Request a new code.', 'OTP_LOCKED');
      if (rec.code !== String(body?.otp)) {
        rec.attempts += 1;
        return fail(422, 'Incorrect code. Please try again.', 'OTP_INVALID');
      }
      state.otps.delete(rec.requestId);
      const token = `tok-${++state.seq}`;
      const expiresAt = now() + 30 * 24 * 3600 * 1000;
      state.sessions.set(token, { email: rec.email, expiresAt });
      return ok({ accessToken: token, expiresAt: new Date(expiresAt).toISOString(), user: state.users.get(rec.email) });
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
    if (method === 'GET' && path === 'me') return ok(user);
    if (method === 'PATCH' && path === 'me') {
      if (!String(body?.firstName ?? '').trim()) return fail(422, 'First name is required.', 'VALIDATION');
      Object.assign(user, { firstName: body.firstName, lastName: body.lastName, mobile: body.mobile });
      return ok(user);
    }
    if (method === 'DELETE' && path === 'me') {
      state.deletionRequests.push(user.email);
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
      const replay = state.idempotency.get(`${user.email}:${key}`);
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
        id: `bk-${++state.seq}`, userEmail: user.email, counsellorId: counsellor.id, counsellorName: counsellor.name,
        start: body.slotStart, end: new Date(Date.parse(body.slotStart) + 3600000).toISOString(), mode: body.mode,
        issue: body.issueId ? 'Stress' : null, language: body.language ?? null, status: 'confirmed',
        joinUrl: body.mode === 'video' ? 'https://zoom.example/j/123' : null, cancellable: true,
        notification: { sms },
      };
      state.bookings.push(booking);
      state.idempotency.set(`${user.email}:${key}`, booking);
      return ok(booking, 201);
    }
    if (method === 'GET' && path === 'bookings') {
      return ok({ items: state.bookings.filter((b) => b.userEmail === user.email), nextPage: null });
    }
    m = path.match(/^bookings\/([^/]+)\/cancel$/);
    if (method === 'POST' && m) {
      const b = state.bookings.find((x) => x.id === m![1] && x.userEmail === user.email);
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

  return { fetch: fetchImpl, state };
}

export type MockServer = ReturnType<typeof createMockServer>;
