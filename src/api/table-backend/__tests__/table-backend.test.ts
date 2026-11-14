import { createApiClient } from '@/api/client';
import { createEndpoints } from '@/api/endpoints';
import { ApiError } from '@/api/errors';

import { createTableBackend, OTP_DEVICE_MAX_PER_DAY, OTP_DEVICE_MAX_PER_HOUR, OTP_WRONG_MAX, WRITE_LIMITS, type LimitStorage, OTP_MAX_ATTEMPTS, OTP_MAX_PER_HOUR, OTP_RESEND_MS, OTP_TTL_MS, type SessionStorage } from '..';
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

  let storedLimits: unknown = null;
  const limitStorage: LimitStorage = {
    read: async () => JSON.parse(JSON.stringify(storedLimits)),
    write: async (l) => {
      storedLimits = JSON.parse(JSON.stringify(l));
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
      limitStorage,
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

  const lastCode = () => decodeURIComponent(sms[sms.length - 1]).match(/code is (\d{6})/)![1];

  return {
    db, calls, sms, state, api, signIn, lastCode,
    restart: () => {
      backend = makeBackend();
    },
    setToken: (t: string | null) => {
      token = t;
    },
    writes: () => calls.filter((c) => c.method !== 'GET'),
    corruptLimits: (value: unknown) => {
      storedLimits = value;
    },
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

describe('sign up (the app adds the person to employee_list)', () => {
  const details = {
    userType: 'corporate' as const,
    firstName: '  Meera <b>',
    lastName: 'Iyer',
    email: 'Meera@Fixture.com',
    mobile: '+919000011111',
    companyName: 'Fixture Corp',
    employeeId: 'FC-7',
  };

  it('writes nothing until the SMS code is verified, then inserts one row and signs in', async () => {
    const w = createWorld();
    const req = await w.api.auth.register(details);
    expect(w.sms).toHaveLength(1);
    expect(w.sms[0]).toContain('to=919000011111');
    expect(w.writes()).toHaveLength(0);

    const session = await w.api.auth.verifyOtp(req.requestId, w.lastCode());
    const posts = w.writes();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ method: 'POST', path: 'employee_list' });
    expect(posts[0].body).toMatchObject({
      emp_name: 'Meera b',
      emp_lname: 'Iyer',
      emp_email: 'meera@fixture.com',
      emp_mobile: '9000011111',
      emp_option: 'Corporate',
      emp_organisationname: 'Fixture Corp',
      emp_password: '',
      emp_otp: '',
      status: 'Active',
      reg_date: '25-10-2026',
      created_at: '25-10-2026 11:30:00 AM',
    });
    expect(posts[0].body).not.toHaveProperty('emp_id');
    expect(session.user).toMatchObject({ firstName: 'Meera b', mobile: '+919000011111', userType: 'corporate', companyName: 'Fixture Corp' });

    // The new account works like any other: it can sign in again later.
    w.state.now += 2 * 60 * 1000;
    expect((await w.signIn('+919000011111')).user.id).toBe(session.user.id);
  });

  it('finds the new row when the server returns its id', async () => {
    const w = createWorld({ postReturnsId: true });
    const req = await w.api.auth.register({ ...details, userType: 'individual', companyName: null });
    const session = await w.api.auth.verifyOtp(req.requestId, w.lastCode());
    expect(session.user).toMatchObject({ id: '104', userType: 'individual', companyName: null });
  });

  it('refuses a number that already has an account, or that the team switched off', async () => {
    const w = createWorld();
    expect((await apiError(w.api.auth.register({ ...details, mobile: '+919876543210' }))).code).toBe('ALREADY_REGISTERED');
    expect((await apiError(w.api.auth.register({ ...details, mobile: '+919000000003' }))).code).toBe('ACCOUNT_INACTIVE');
    expect(w.sms).toHaveLength(0);
    expect(w.writes()).toHaveLength(0);
  });

  it('checks the details before sending an SMS', async () => {
    const w = createWorld();
    expect((await apiError(w.api.auth.register({ ...details, firstName: '<>' }))).code).toBe('VALIDATION');
    expect((await apiError(w.api.auth.register({ ...details, email: 'nope' }))).code).toBe('VALIDATION');
    expect((await apiError(w.api.auth.register({ ...details, companyName: ' ' }))).code).toBe('VALIDATION');
    expect((await apiError(w.api.auth.register({ ...details, mobile: '12345' }))).code).toBe('INVALID_MOBILE');
    expect(w.sms).toHaveLength(0);
  });

  it('does not create the account with a wrong code', async () => {
    const w = createWorld();
    const req = await w.api.auth.register(details);
    expect((await apiError(w.api.auth.verifyOtp(req.requestId, '000000'))).code).toBe('OTP_INVALID');
    expect(w.writes()).toHaveLength(0);
    expect(w.db.employee_list).toHaveLength(3);
  });

  it('can be retried after a dropped connection without creating a second row', async () => {
    const w = createWorld();
    const req = await w.api.auth.register(details);
    const code = w.lastCode();
    w.state.failNext = 'network';
    expect((await apiError(w.api.auth.verifyOtp(req.requestId, code))).kind).toBe('network');
    const session = await w.api.auth.verifyOtp(req.requestId, code);
    expect(session.user.mobile).toBe('+919000011111');
    expect(w.db.employee_list.filter((r) => r.emp_mobile === '9000011111')).toHaveLength(1);
  });

  it('shares the SMS cooldown with sign-in', async () => {
    const w = createWorld();
    await w.api.auth.register(details);
    expect((await apiError(w.api.auth.register(details))).code).toBe('OTP_COOLDOWN');
    expect(w.sms).toHaveLength(1);
  });
});

describe('rate limits kept on the device', () => {
  const input = (slotStart: string) => ({
    counsellorId: '7', slotStart, mode: 'video' as const, issueId: 'Anxiety Management', language: null, notes: 'First session',
  });
  const signup = (n: number) => ({
    userType: 'individual' as const,
    firstName: 'New',
    lastName: null,
    email: `new${n}@example.com`,
    mobile: `+9190000200${String(n).padStart(2, '0')}`,
    companyName: null,
    employeeId: null,
  });

  it('keeps the resend cooldown after the app is closed and reopened', async () => {
    const w = createWorld();
    await w.api.auth.requestOtp('+919876543210');
    w.restart();
    const err = await apiError(w.api.auth.requestOtp('+919876543210'));
    expect(err.code).toBe('OTP_COOLDOWN');
    expect(err.retryAfterSeconds).toBe(60);
    expect(w.sms).toHaveLength(1);
  });

  it('caps the SMS one device can trigger across different numbers', async () => {
    const w = createWorld();
    for (let i = 0; i < OTP_DEVICE_MAX_PER_HOUR; i++) await w.api.auth.register(signup(i));
    const err = await apiError(w.api.auth.register(signup(50)));
    expect(err.code).toBe('OTP_LIMIT');
    expect(err.retryAfterSeconds).toBe(3600);
    expect(w.sms).toHaveLength(OTP_DEVICE_MAX_PER_HOUR);

    // An hour later the hourly cap has cleared, but the daily cap still applies.
    for (let sent = OTP_DEVICE_MAX_PER_HOUR, n = 60; sent < OTP_DEVICE_MAX_PER_DAY; ) {
      w.state.now += 3600 * 1000 + 1000;
      for (let i = 0; i < OTP_DEVICE_MAX_PER_HOUR && sent < OTP_DEVICE_MAX_PER_DAY; i++, sent++) await w.api.auth.register(signup(n++));
    }
    w.state.now += 3600 * 1000 + 1000;
    expect((await apiError(w.api.auth.register(signup(99)))).code).toBe('OTP_LIMIT');
    expect(w.sms).toHaveLength(OTP_DEVICE_MAX_PER_DAY);
  });

  it('pauses code entry after too many wrong codes, even across new requests and restarts', async () => {
    const w = createWorld();
    let req = await w.api.auth.requestOtp('+919876543210');
    for (let i = 0; i < OTP_WRONG_MAX; i++) {
      if (i > 0 && i % 4 === 0) {
        w.state.now += 61 * 1000;
        req = await w.api.auth.requestOtp('+919876543210');
      }
      expect((await apiError(w.api.auth.verifyOtp(req.requestId, '000000'))).code).toBe('OTP_INVALID');
    }
    const code = w.lastCode();
    const locked = await apiError(w.api.auth.verifyOtp(req.requestId, code));
    expect(locked.code).toBe('OTP_LOCKED');
    expect(locked.kind).toBe('rate_limited');

    w.restart();
    w.state.now += 61 * 1000;
    const again = await w.api.auth.requestOtp('+919876543210');
    expect((await apiError(w.api.auth.verifyOtp(again.requestId, w.lastCode()))).code).toBe('OTP_LOCKED');

    w.state.now += 15 * 60 * 1000;
    const fresh = await w.api.auth.requestOtp('+919876543210');
    expect((await w.api.auth.verifyOtp(fresh.requestId, w.lastCode())).user.id).toBe('101');
  });

  it('limits how many bookings one device can make in an hour', async () => {
    const w = createWorld();
    await w.signIn();
    for (let i = 0; i < WRITE_LIMITS.booking.max; i++) {
      await w.api.bookings.create(input(istToIso('2026-10-29', (12 + i) * 60)), `k${i}`);
    }
    const err = await apiError(w.api.bookings.create(input(istToIso('2026-10-30', 12 * 60)), 'k-last'));
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.kind).toBe('rate_limited');
    expect(w.calls.filter((c) => c.method === 'POST')).toHaveLength(WRITE_LIMITS.booking.max);

    w.state.now += 3600 * 1000 + 1000;
    await expect(w.api.bookings.create(input(istToIso('2026-10-30', 12 * 60)), 'k-last')).resolves.toBeTruthy();
  });

  it('limits how many accounts one device can create in a day', async () => {
    const w = createWorld();
    for (let i = 0; i < WRITE_LIMITS.signup.max; i++) {
      const req = await w.api.auth.register(signup(i));
      await w.api.auth.verifyOtp(req.requestId, w.lastCode());
    }
    expect((await apiError(w.api.auth.register(signup(40)))).code).toBe('RATE_LIMITED');
    expect(w.calls.filter((c) => c.method === 'POST')).toHaveLength(WRITE_LIMITS.signup.max);
  });

  it('strips markup from text a person types before it is stored', async () => {
    const w = createWorld();
    await w.signIn();
    await w.api.bookings.create({ ...input(istToIso('2026-10-29', 12 * 60)), notes: '<script>alert(1)</script> call\u0000 me' }, 'k');
    expect(w.calls.find((c) => c.method === 'POST')!.body!.appointment_notes).toBe('scriptalert(1)/script call me');
  });

  it('starts clean when the stored history is damaged', async () => {
    const w = createWorld();
    w.corruptLimits({ sms: 'x', device: [1, 'a', null], wrong: {}, writes: [] });
    await expect(w.api.auth.requestOtp('+919876543210')).resolves.toBeTruthy();
  });
});
