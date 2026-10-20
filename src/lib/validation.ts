import { OTP_LENGTH } from '@/config/constants';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Enter your email address.';
  if (v.length > 254 || !EMAIL.test(v)) return 'Enter a valid email address.';
  return null;
}

export function validateOtp(value: string): string | null {
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value)) return `Enter the ${OTP_LENGTH}-digit code.`;
  return null;
}

/** Keeps only digits, capped at the OTP length (handles pasted codes with spaces). */
export function sanitizeOtp(value: string): string {
  return value.replace(/\D/g, '').slice(0, OTP_LENGTH);
}

/** Indian mobile: optional +91/91/0 prefix followed by 10 digits starting 6-9. Empty is allowed. */
export function normalizeIndianMobile(value: string): { value: string | null; error: string | null } {
  const raw = value.replace(/[\s-]/g, '');
  if (!raw) return { value: null, error: null };
  const m = raw.match(/^(?:\+?91|0)?([6-9]\d{9})$/);
  if (!m) return { value: null, error: 'Enter a valid 10-digit Indian mobile number.' };
  return { value: `+91${m[1]}`, error: null };
}

export function validateName(value: string, label = 'Name'): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (v.length > 60) return `${label} is too long.`;
  // \p{M} admits combining marks used by Indic scripts (Tamil, Hindi, …).
  if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(v)) return `${label} contains invalid characters.`;
  return null;
}

export const PASSWORD_MIN_LENGTH = 8;

/** At least 8 characters with a letter and a number (matches the server rule). */
export function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (value.length > 64) return 'Password must be 64 characters or fewer.';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Use at least one letter and one number.';
  return null;
}

export const MIN_AGE = 18;
export const MAX_AGE = 100;

/** Optional age in whole years. CecureUs accounts are for adults (18+). */
export function parseAge(value: string): { value: number | null; error: string | null } {
  const v = value.trim();
  if (!v) return { value: null, error: null };
  if (!/^\d{1,3}$/.test(v)) return { value: null, error: 'Enter your age in whole years.' };
  const n = Number(v);
  if (n < MIN_AGE) return { value: null, error: `You must be ${MIN_AGE} or older to use CecureUs.` };
  if (n > MAX_AGE) return { value: null, error: `Enter an age between ${MIN_AGE} and ${MAX_AGE}.` };
  return { value: n, error: null };
}

/** Optional corporate employee ID: letters, digits, dot, dash or underscore. */
export function validateEmployeeId(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^[A-Za-z0-9._-]{2,30}$/.test(v)) return 'Use 2–30 letters, numbers, dots, dashes or underscores.';
  return null;
}
