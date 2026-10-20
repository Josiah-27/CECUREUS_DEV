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
