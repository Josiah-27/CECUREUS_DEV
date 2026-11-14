import { createApiClient } from '@/api/client';
import { createEndpoints } from '@/api/endpoints';
import { ApiError } from '@/api/errors';

import { createTableBackend, OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_RESEND_MS, OTP_TTL_MS, type SessionStorage } from '..';
import type { Row } from '../mapping';
import { buildSmsUrl, DEFAULT_SMS_MESSAGE } from '../sms';
import { istToIso, legacyTimestamp, parseClock, parseTimeRange } from '../time';

const BASE = 'https://table-backend.local/v1';
const TABLE_API = 'https://tables.test/api';
const SMS = 'https://sms.test/send?key=SECRET&to={mobile91}&text={message}';
const NOW = Date.parse('2026-10-25T06:00:00.000Z'); // 11:30 AM IST, Sunday
const KEYS: Record<string, string> = {
  employee_list: 'emp_id',
  doctor_list: 'doc_id',
  booking_appointment: 'book_id',
  doctor_category: 'cat_id',
};
const ALLOWED = new Set(['GET', 'POST', 'PUT', 'DELETE']);

function employee(fields: Row): Row {
  return {
    emp_id: '101', emp_otp: '', emp_companyname: 'Fixture Corp', emp_name: 'Harsha', emp_lname: 'Verma',
    emp_companyid: '', emp_email: 'harsha@fixturecorp.com', emp_password: 'e10adc3949ba59abbe56e057f20f883e',
    emp_mobile: '9876543210', emp_age: '', emp_option: 'Corporate', emp_organisationname: '', status: 'Active',
    ...fields,
  };
}

function doctor(fields: Row): Row {
  return {
    doc_id: '7', doc_name: 'Dr. Asha Rao', doc_cityname: 'Chennai', doc_city: '498', doc_otp: '4321',
    doc_email: 'asha@private.test', doc_password: 'md5-secret-hash', doc_mobile: '9000011111',
    doc_pannumber: 'ABCDE1234F', bank_acc_number: '000123456789', bank_ifsc: 'SBIN0000001', zoomid: 'zoom-secret',
    doc_experiance: '10', doc_prelanguage: '', doc_description: 'Calm, practical counselling.',
    doc_category: 'Anxiety Management, Stress Management , Anxiety Management', doct_image: '1700000000asha.jpg',
    status: 'active',
    ...fields,
  };
}

function booking(fields: Row): Row {
  return {
    book_id: '500', customer_id: '999', doc_id: '7', doc_name: 'Dr. Asha Rao', service_time: '60 Minutes',
    issuse_name: 'Stress Management', speaking_language: 'English', connectoption: 'voice',
    booknewdate: '2026-10-26', meating_timelist: '10:00 AM - 11:00 AM', meating_starttime: '10:00 AM ',
    meating_endtime: ' 11:00 AM', join_url: '', start_url: 'https://zoom.us/s/host-secret', status: '',
    bookedby: 'admin', created_at: '20-10-2026 10:00:00 AM',
    ...fields,
  };
}

function createWorld(opts: { sms?: string | null; consoleFallback?: boolean; postReturnsId?: boolean } = {}) {
  const db: Record<string, Row[]> = {
    employee_list: [
      employee({}),
      employee({ emp_id: '102', emp_mobile: '91-9812345678', emp_name: 'Priya', emp_option: 'Individual' }),
      employee({ emp_id: '103', emp_mobile: '9000000003', status: 'DeActive' }),
    ],
    doctor_list: [
      doctor({}),
      doctor({ doc_id: '8', doc_name: 'Dr. Inactive', status: 'cancel' }),
      doctor({ doc_id: '9', doc_name: 'Dr. Ben Paul', doc_category: 'Career Counselling', doc_cityname: 'Pune' }),
    ],
    booking_appointment: [
      booking({}),
      booking({ book_id: '501', customer_id: '101', status: 'Completed', booknewdate: '2026-09-01' }),
      booking({ book_id: '502', customer_id: '101', status: 'Cancel', booknewdate: '2026-09-02', meating_timelist: '6:00 PM - 7:00 PM' }),
    ],
    doctor_category: [],
  };
  const calls: { method: string; path: string; body?: Row }[] = [];
  const sms: string[] = [];
  const state = { failNext: null as null | 'network' | number, now: NOW };

  const net = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.host === 'sms.test') {
      sms.push(String(input));
      return new Response('OK', { status: 200 });
    }
    const method = (init.method ?? 'GET').toUpperCase();
    const [table, id] = url.pathname.replace(/^\/api\//, '').split('/');
    const body = init.body ? (JSON.parse(String(init.body)) as Row) : undefined;
    calls.push({ method, path: url.pathname.replace(/^\/api\//, ''), body });
    const fail = state.failNext;
    state.failNext = null;
    if (fail === 'network') throw new TypeError('Network request failed');
    if (typeof fail === 'number') return new Response('{"status":false,"message":"db down"}', { status: fail });
    if (!ALLOWED.has(method)) return new Response('', { status: 405 });
    if (!KEYS[table]) return new Response('', { status: 403 });
    const rows = db[table];
    const key = KEYS[table];
    const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });
    if (method === 'GET') return json({ status: true, data: id ? rows.filter((r) => String(r[key]) === id) : rows });
    if (method === 'PUT') {
      const row = rows.find((r) => String(r[key]) === id);
      if (row) Object.assign(row, body);
      return json({ status: true, message: 'Record updated' });
    }
    if (method === 'POST') {
      const next = String(Math.max(0, ...rows.map((r) => Number(r[key]))) + 1);
      rows.push({ ...body, [key]: next });
      return json(opts.postReturnsId ? { status: true, id: Number(next) } : { status: true, message: 'Record inserted' });
    }
    return json({ status: true });
  }) as typeof fetch;

  let stored: Record<string, unknown> = {};
  const sessionStorage: SessionStorage = {
    read: async () => JSON.parse(JSON.stringify(stored)),
    write: async (s) => {
      stored = JSON.parse(JSON.stringify(s));
    },
  };

  let otpSeq = 0;
  let tokenSeq = 0;
  const makeBackend = () =>
    createTableBackend({
      baseUrl: BASE,
      tableApiUrl: TABLE_API,
      sms: {
        urlTemplate: opts.sms === undefined ? SMS : opts.sms,
        messageTemplate: DEFAULT_SMS_MESSAGE,
        allowConsoleFallback: opts.consoleFallback ?? false,
      },
      fetchImpl: net,
      sessionStorage,
      now: () => state.now,
      generateOtp: () => String(482910 + otpSeq++),
      generateToken: () => `token-${++tokenSeq}`,
    });

  let backend = makeBackend();
  let token: string | null = null;
  const api = createEndpoints(
    createApiClient({ baseUrl: BASE, fetchImpl: (i, init) => backend.fetch(i, init), getAccessToken: async () => token }),
  );

  async function signIn(mobile = '+919876543210') {
    const req = await api.auth.requestOtp(mobile);
    const code = decodeURIComponent(sms[sms.length - 1]).match(/code is (\d{6})/)![1];
    const session = await api.auth.verifyOtp(req.requestId, code);
    token = session.accessToken;
    return session;
  }

  return {
    db, calls, sms, state, api, signIn,
    restart: () => {
      backend = makeBackend();
    },
    setToken: (t: string | null) => {
      token = t;
    },
    writes: () => calls.filter((c) => c.method !== 'GET'),
  };
}

async function apiError(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('expected an ApiError');
}

describe('time helpers', () => {
  it('parses and builds the legacy IST formats', () => {
    expect(parseClock('6:00 PM')).toBe(18 * 60);
    expect(parseClock('12:15 AM')).toBe(15);
    expect(parseClock('12:00 PM')).toBe(12 * 60);
    expect(parseTimeRange('2:00 PM - 3:00 PM')).toEqual({ start: 840, end: 900 });
    expect(istToIso('2026-10-26', 10 * 60)).toBe('2026-10-26T04:30:00.000Z');
    expect(legacyTimestamp(NOW)).toBe('25-10-2026 11:30:00 AM');
  });

  it('fills the SMS gateway template', () => {
    const url = buildSmsUrl(SMS, '+919876543210', '123456', DEFAULT_SMS_MESSAGE);
    expect(url).toContain('to=919876543210');
    expect(decodeURIComponent(url)).toContain('Your CecureUs verification code is 123456.');
  });
});

describe('sign in (employee_list, read only)', () => {
  it('sends an SMS code to an active employee and opens a session — without writing to any table', async () => {
    const w = createWorld();
    const session = await w.signIn('+919876543210');
    expect(w.sms).toHaveLength(1);
    expect(w.sms[0]).toContain('to=919876543210');
    expect(session.user).toEqual(
      expect.objectContaining({ id: '101', firstName: 'Harsha', userType: 'corporate', mobile: '+919876543210', companyName: 'Fixture Corp' }),
    );
    expect(JSON.stringify(session)).not.toMatch(/e10adc|emp_password|emp_otp/);
    expect(w.writes()).toHaveLength(0);
    expect(await w.api.profile.get()).toEqual(expect.objectContaining({ id: '101' }));
  });

  it('matches numbers stored as "91-…" and maps individuals', async () => {
    const w = createWorld();
    const session = await w.signIn('+919812345678');
    expect(session.user).toEqual(expect.objectContaining({ id: '102', userType: 'individual' }));
  });

  it('refuses unregistered and deactivated numbers without sending an SMS', async () => {
    const w = createWorld();
    expect((await apiError(w.api.auth.requestOtp('+919000000001'))).code).toBe('NOT_REGISTERED');
    expect((await apiError(w.api.auth.requestOtp('+919000000003'))).code).toBe('ACCOUNT_INACTIVE');
    expect(w.sms).toHaveLength(0);
  });

  it('rejects wrong, expired and brute-forced codes', async () => {
    const w = createWorld();
    let req = await w.api.auth.requestOtp('+919876543210');
    expect((await apiError(w.api.auth.verifyOtp(req.requestId, '000000'))).code).toBe('OTP_INVALID');
    for (let i = 1; i < OTP_MAX_ATTEMPTS; i++) await apiError(w.api.auth.verifyOtp(req.requestId, '000000'));
    expect((await apiError(w.api.auth.verifyOtp(req.requestId, '482910'))).code).toBe('OTP_LOCKED');

    w.state.now += OTP_RESEND_MS + 1;
    req = await w.api.auth.requestOtp('+919876543210');
    w.state.now += OTP_TTL_MS + 1;
    expect((await apiError(w.api.auth.verifyOtp(req.requestId, '482911'))).code).toBe('OTP_EXPIRED');
  });

  it('enforces the resend cooldown and an hourly SMS cap', async () => {
    const w = createWorld();
    await w.api.auth.requestOtp('+919876543210');
    const cooldown = await apiError(w.api.auth.requestOtp('+919876543210'));
    expect(cooldown.kind).toBe('rate_limited');
    expect(cooldown.retryAfterSeconds).toBe(60);
    for (let i = 1; i < OTP_MAX_PER_HOUR; i++) {
      w.state.now += OTP_RESEND_MS + 1;
      await w.api.auth.requestOtp('+919876543210');
    }
    w.state.now += OTP_RESEND_MS + 1;
    expect((await apiError(w.api.auth.requestOtp('+919876543210'))).code).toBe('OTP_LIMIT');
    expect(w.sms).toHaveLength(OTP_MAX_PER_HOUR);
  });

  it('keeps the session across app restarts and ends it when the team deactivates the account', async () => {
    const w = createWorld();
    await w.signIn();
    w.restart();
    expect((await w.api.profile.get()).id).toBe('101');
    w.db.employee_list[0].status = 'DeActive';
    w.restart();
    expect((await apiError(w.api.profile.get())).kind).toBe('unauthorized');
  });

  it('reports an unconfigured SMS gateway as a temporary failure (production)', async () => {
    const w = createWorld({ sms: null });
    expect((await apiError(w.api.auth.requestOtp('+919876543210'))).code).toBe('SMS_NOT_CONFIGURED');
  });

  it('prints the code to the console in development when no gateway is configured', async () => {
    const info = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const w = createWorld({ sms: null, consoleFallback: true });
    const req = await w.api.auth.requestOtp('+919876543210');
    expect(info).toHaveBeenCalledWith(expect.stringContaining('482910'));
    expect((await w.api.auth.verifyOtp(req.requestId, '482910')).user.id).toBe('101');
    info.mockRestore();
  });
});

describe('counsellors (doctor_list, read only)', () => {
  it('lists only active counsellors and never exposes private columns', async () => {
    const w = createWorld();
    await w.signIn();
    const page = await w.api.counsellors.list({});
    expect(page.items.map((c) => c.name)).toEqual(['Dr. Asha Rao', 'Dr. Ben Paul']);
    expect(page.items[0]).toEqual(
      expect.objectContaining({
        id: '7', city: 'Chennai', experienceYears: 10, expertise: ['Anxiety Management', 'Stress Management'],
        imageUrl: '1700000000asha.jpg', sessionsCount: 1, modes: ['audio', 'video'],
      }),
    );
    const json = JSON.stringify(page);
    for (const secret of ['md5-secret-hash', 'ABCDE1234F', '000123456789', 'SBIN0000001', '9000011111', 'asha@private.test', 'zoom-secret', '4321']) {
      expect(json).not.toContain(secret);
    }
  });

  it('searches and filters by expertise', async () => {
    const w = createWorld();
    await w.signIn();
    expect((await w.api.counsellors.list({ search: 'pune' })).items.map((c) => c.id)).toEqual(['9']);
    expect((await w.api.counsellors.list({ expertise: 'Anxiety Management' })).items.map((c) => c.id)).toEqual(['7']);
    expect((await w.api.reference.issues()).map((i) => i.name)).toEqual([
      'Anxiety Management',
      'Career Counselling',
      'Stress Management',
    ]);
    expect((await apiError(w.api.counsellors.get('8'))).kind).toBe('not_found');
  });

  it('offers hourly IST slots, hiding past, too-soon and already-booked times', async () => {
    const w = createWorld();
    await w.signIn();
    const a = await w.api.counsellors.availability('7', '2026-10-25', '2026-10-26');
    expect(a.timezone).toBe('Asia/Kolkata');
    const today = a.days.find((d) => d.date === '2026-10-25')!.slots.map((s) => s.start);
    // Now is 11:30 IST: 12:00 is inside the 1-hour lead time, so the first slot is 1:00 PM.
    expect(today[0]).toBe(istToIso('2026-10-25', 13 * 60));
    const tomorrow = a.days.find((d) => d.date === '2026-10-26')!.slots.map((s) => s.start);
    expect(tomorrow).not.toContain(istToIso('2026-10-26', 10 * 60)); // booked by another user
    expect(tomorrow[0]).toBe(istToIso('2026-10-26', 11 * 60));
    expect(tomorrow[tomorrow.length - 1]).toBe(istToIso('2026-10-26', 20 * 60));
  });
});

describe('bookings (booking_appointment)', () => {
  const input = (slotStart: string, mode: 'audio' | 'video' = 'video') => ({
    counsellorId: '7', slotStart, mode, issueId: 'Anxiety Management', language: null, notes: 'First session',
  });

  it('creates a booking row in the format the website uses', async () => {
    const w = createWorld();
    await w.signIn();
    const b = await w.api.bookings.create(input(istToIso('2026-10-26', 18 * 60)), 'key-1');
    expect(b).toEqual(
      expect.objectContaining({
        counsellorId: '7', counsellorName: 'Dr. Asha Rao', mode: 'video', status: 'pending', cancellable: true,
        start: istToIso('2026-10-26', 18 * 60), end: istToIso('2026-10-26', 19 * 60), issue: 'Anxiety Management',
      }),
    );
    const posts = w.calls.filter((c) => c.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe('booking_appointment');
    expect(posts[0].body).toEqual(
      expect.objectContaining({
        customer_id: '101', doc_id: '7', doc_name: 'Dr. Asha Rao', booknewdate: '2026-10-26',
        meating_timelist: '6:00 PM - 7:00 PM', meating_starttime: '6:00 PM ', meating_endtime: ' 7:00 PM',
        service_time: '60 Minutes', connectoption: 'Video Call', speaking_language: 'English', status: '',
        bookedby: 'user', access_status: 'Active', created_at: '25-10-2026 11:30:00 AM', appointment_notes: 'First session',
      }),
    );
    expect(w.calls.every((c) => ALLOWED.has(c.method))).toBe(true);
  });

  it('does not book twice when a lost response is retried', async () => {
    const w = createWorld({ postReturnsId: true });
    await w.signIn();
    const first = await w.api.bookings.create(input(istToIso('2026-10-27', 15 * 60), 'audio'), 'key-1');
    const again = await w.api.bookings.create(input(istToIso('2026-10-27', 15 * 60), 'audio'), 'key-1');
    expect(again.id).toBe(first.id);
    expect(w.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('refuses a slot that is already booked, outside hours, or chat', async () => {
    const w = createWorld();
    await w.signIn();
    expect((await apiError(w.api.bookings.create(input(istToIso('2026-10-26', 10 * 60)), 'k'))).code).toBe('SLOT_UNAVAILABLE');
    expect((await apiError(w.api.bookings.create(input(istToIso('2026-10-26', 22 * 60)), 'k'))).code).toBe('SLOT_UNAVAILABLE');
    expect((await apiError(w.api.bookings.create({ ...input(istToIso('2026-10-26', 15 * 60)), mode: 'chat' }, 'k'))).code).toBe('INVALID_MODE');
    expect(w.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('lists only the signed-in user’s bookings with mapped statuses, and cancels via PUT', async () => {
    const w = createWorld();
    await w.signIn();
    const created = await w.api.bookings.create(input(istToIso('2026-10-28', 12 * 60)), 'k');
    const list = await w.api.bookings.list();
    expect(list.items.map((b) => [b.id, b.status])).toEqual([
      [created.id, 'pending'],
      ['502', 'cancelled'],
      ['501', 'completed'],
    ]);

    const cancelled = await w.api.bookings.cancel(created.id, 'Schedule clash');
    expect(cancelled.status).toBe('cancelled');
    expect(w.calls.filter((c) => c.method === 'PUT').pop()).toEqual({
      method: 'PUT',
      path: `booking_appointment/${created.id}`,
      body: { status: 'Cancel', canceledby: 'User', reason: 'Schedule clash', updated_at: '25-10-2026 11:30:00 AM' },
    });
    expect((await apiError(w.api.bookings.cancel('500', 'not mine'))).kind).toBe('not_found');
  });

  it('shows a booking as confirmed once the team adds the Zoom link', async () => {
    const w = createWorld();
    await w.signIn();
    w.db.booking_appointment.push(booking({ book_id: '600', customer_id: '101', booknewdate: '2026-10-30', join_url: 'https://us06web.zoom.us/j/123' }));
    const b = (await w.api.bookings.list()).items.find((x) => x.id === '600')!;
    expect(b.status).toBe('confirmed');
    expect(b.joinUrl).toBe('https://us06web.zoom.us/j/123');
    expect(JSON.stringify(b)).not.toContain('host-secret');
  });
});

describe('profile (employee_list PUT)', () => {
  it('updates name and age with a partial PUT', async () => {
    const w = createWorld();
    await w.signIn();
    const user = await w.api.profile.update({ firstName: 'Harsh', lastName: 'V', age: 30 });
    expect(user).toEqual(expect.objectContaining({ firstName: 'Harsh', lastName: 'V', age: 30 }));
    expect(w.writes()).toEqual([
      {
        method: 'PUT',
        path: 'employee_list/101',
        body: { emp_name: 'Harsh', emp_lname: 'V', emp_age: '30', updated_at: '25-10-2026 11:30:00 AM' },
      },
    ]);
  });

  it('turns an account deletion into a deactivation and ends the session', async () => {
    const w = createWorld();
    await w.signIn();
    await w.api.profile.requestDeletion();
    expect(w.db.employee_list[0].status).toBe('Cancel');
    expect((await apiError(w.api.profile.get())).kind).toBe('unauthorized');
  });
});

describe('errors', () => {
  it('maps table API failures to a generic server error and network failures to offline', async () => {
    const w = createWorld();
    await w.signIn();
    w.state.failNext = 500;
    const server = await apiError(w.api.counsellors.list({ search: 'x' }));
    expect(server.kind).toBe('server');
    expect(server.message).not.toContain('db down');
    w.state.failNext = 'network';
    expect((await apiError(w.api.bookings.list())).kind).toBe('network');
  });
});
