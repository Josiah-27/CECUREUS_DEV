/**
 * Maps rows of the legacy tables to the app's API shapes (src/api/schemas.ts).
 *
 * Only whitelisted fields are copied. Sensitive columns (emp_password, emp_otp, doc_password,
 * doc_otp, bank_*, doc_pannumber, doc_mobile, doc_email, start_url, zoom ids …) are never read.
 */
import { formatClock, istToIso, parseClock, parseDurationMinutes, parseTimeRange } from './time';

export type Row = Record<string, unknown>;

export const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());
const orNull = (v: unknown): string | null => str(v) || null;
const lower = (v: unknown) => str(v).toLowerCase();

// ---------- employee_list ----------

/**
 * Normalises the many formats in emp_mobile ("9876543210", "91-9876543210", "09876543210",
 * "98765 43210") to E.164 "+919876543210"; null when it is not a valid Indian mobile.
 */
export function normalizeDbMobile(value: unknown): string | null {
  const digits = str(value).replace(/\D/g, '');
  const m = digits.match(/^(?:0|91|091|0091)?([6-9]\d{9})$/);
  return m ? `+91${m[1]}` : null;
}

export const isActiveEmployee = (row: Row) => lower(row.status) === 'active';

export function toUser(row: Row) {
  return {
    id: str(row.emp_id),
    firstName: str(row.emp_name),
    lastName: orNull(row.emp_lname),
    email: orNull(row.emp_email),
    mobile: normalizeDbMobile(row.emp_mobile),
    userType: lower(row.emp_option) === 'corporate' ? 'corporate' : 'individual',
    companyName: orNull(row.emp_companyname) ?? orNull(row.emp_organisationname),
    sessionsRemaining: null,
    age: orNull(row.emp_age),
  };
}

// ---------- doctor_list ----------

export const isActiveDoctor = (row: Row) => lower(row.status) === 'active' && !!str(row.doc_name);

export function toCounsellor(row: Row, completedSessions: number | null) {
  return {
    id: str(row.doc_id),
    name: str(row.doc_name),
    title: null,
    city: orNull(row.doc_cityname),
    experienceYears: orNull(row.doc_experiance),
    languages: str(row.doc_prelanguage),
    expertise: str(row.doc_category),
    about: orNull(row.doc_description),
    imageUrl: orNull(row.doct_image),
    rating: null,
    sessionsCount: completedSessions || null,
    // Existing bookings use "Video Call" and "voice" only.
    modes: ['audio', 'video'],
  };
}

/** Comma-separated doc_category → trimmed, de-duplicated expertise list. */
export function expertiseOf(row: Row): string[] {
  return [...new Set(str(row.doc_category).split(',').map((s) => s.trim()).filter(Boolean))];
}

// ---------- booking_appointment ----------

export const isCancelledBooking = (row: Row) => ['cancel', 'cancelled', 'canceled'].includes(lower(row.status));

/** IST start/end minutes of a booking, from meating_timelist (or start/end time columns). */
export function bookingMinutes(row: Row): { start: number; end: number } | null {
  const range = parseTimeRange(str(row.meating_timelist));
  if (range) return range;
  const start = parseClock(str(row.meating_starttime));
  if (start === null) return null;
  const end = parseClock(str(row.meating_endtime));
  return { start, end: end ?? start + (parseDurationMinutes(str(row.service_time)) ?? 60) };
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end;
}

export function bookingStatus(row: Row): 'pending' | 'confirmed' | 'cancelled' | 'completed' {
  if (isCancelledBooking(row)) return 'cancelled';
  const s = lower(row.status);
  if (s === 'completed' || s === 'unattended') return 'completed';
  // Upcoming bookings have an empty status; the team adds the Zoom link when it is confirmed.
  return /^https:\/\//i.test(str(row.join_url)) ? 'confirmed' : 'pending';
}

/** booking_appointment row → Booking DTO; null when the date/time cannot be parsed. */
export function toBooking(row: Row, now: number) {
  const date = str(row.booknewdate);
  const minutes = bookingMinutes(row);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !minutes) return null;
  const start = istToIso(date, minutes.start);
  const end = istToIso(date, minutes.end > minutes.start ? minutes.end : minutes.start + 60);
  const status = bookingStatus(row);
  const connect = lower(row.connectoption);
  return {
    id: str(row.book_id),
    counsellorId: str(row.doc_id),
    counsellorName: str(row.doc_name),
    start,
    end,
    mode: connect.includes('video') ? 'video' : connect.includes('chat') ? 'chat' : 'audio',
    issue: orNull(row.issuse_name),
    language: orNull(row.speaking_language),
    status,
    joinUrl: /^https:\/\//i.test(str(row.join_url)) ? str(row.join_url) : null,
    cancellable: (status === 'pending' || status === 'confirmed') && Date.parse(start) > now,
    notification: null,
  };
}

export const CONNECT_OPTION: Record<string, string> = { audio: 'voice', video: 'Video Call', chat: 'chat' };

/**
 * New booking_appointment row, in the same format the existing website/admin writes
 * (all columns are NOT NULL varchar/blob, so every column gets a value).
 */
export function newBookingRow(input: {
  customerId: string;
  doctor: Row;
  ymd: string;
  startMinutes: number;
  durationMinutes: number;
  mode: string;
  issue: string | null;
  language: string | null;
  notes: string | null;
  timestamp: string;
}): Row {
  const from = formatClock(input.startMinutes);
  const to = formatClock(input.startMinutes + input.durationMinutes);
  return {
    purchase_id: '',
    customer_id: input.customerId,
    doc_id: str(input.doctor.doc_id),
    doc_name: str(input.doctor.doc_name),
    service_time: `${input.durationMinutes} Minutes`,
    issuse_name: input.issue ?? '',
    speaking_language: input.language ?? 'English',
    familyoption: 'Self',
    connectoption: CONNECT_OPTION[input.mode] ?? 'voice',
    booknewdate: input.ymd,
    zoom_id: '',
    host_id: '',
    start_url: '',
    join_url: '',
    meating_timelist: `${from} - ${to}`,
    meating_starttime: `${from} `,
    meating_endtime: ` ${to}`,
    appointment_notes: input.notes ?? '',
    review_rating: '0',
    review_comments: '',
    created_at: input.timestamp,
    updated_at: input.timestamp,
    status: '',
    bookedby: 'user',
    reason: '',
    canceledby: '',
    access_status: 'Active',
    role: '1',
    popupcount: 0,
    remainder_status: 0,
  };
}
