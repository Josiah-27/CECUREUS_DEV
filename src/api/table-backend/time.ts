/**
 * Date/time helpers for the legacy tables. All stored times are India Standard Time
 * (UTC+05:30, no daylight saving), e.g. booknewdate "2026-02-07" + meating_timelist
 * "2:00 PM - 3:00 PM", created_at "07-02-2026 12:09:31 PM".
 */
export const IST_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 3600 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** "6:00 PM" → 1080 (minutes after midnight); null if unparsable. */
export function parseClock(value: string | null | undefined): number | null {
  const m = String(value ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?\s*[Mm]\.?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 1 || h > 12 || min > 59) return null;
  return ((h % 12) + (m[3].toUpperCase() === 'P' ? 12 : 0)) * 60 + min;
}

/** 1080 → "6:00 PM". */
export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 || 12;
  return `${h12}:${pad(minutes % 60)} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "2:00 PM - 3:00 PM" → { start: 840, end: 900 }. */
export function parseTimeRange(value: string | null | undefined): { start: number; end: number } | null {
  const parts = String(value ?? '').split('-');
  if (parts.length !== 2) return null;
  const start = parseClock(parts[0]);
  const end = parseClock(parts[1]);
  return start === null || end === null ? null : { start, end };
}

/** "60 Minutes" → 60. */
export function parseDurationMinutes(value: string | null | undefined): number | null {
  const m = String(value ?? '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** IST calendar date + minutes after IST midnight → ISO instant (UTC). */
export function istToIso(ymd: string, minutes: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + minutes * 60000 - IST_OFFSET_MS).toISOString();
}

/** ISO instant → IST calendar date + minutes after IST midnight. */
export function isoToIst(iso: string): { ymd: string; minutes: number } | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const ist = new Date(ms + IST_OFFSET_MS);
  return { ymd: ist.toISOString().slice(0, 10), minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes() };
}

export function addDaysYmd(ymd: string, days: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Legacy timestamp format used across the tables: "07-02-2026 12:09:31 PM" (IST). */
export function legacyTimestamp(ms: number): string {
  const d = new Date(ms + IST_OFFSET_MS);
  const h = d.getUTCHours();
  return (
    `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ` +
    `${pad(h % 12 || 12)}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${h < 12 ? 'AM' : 'PM'}`
  );
}
