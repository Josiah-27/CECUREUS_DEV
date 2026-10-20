/** Date helpers. Slot times from the API are absolute ISO instants; display uses the device time zone. */

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** YYYY-MM-DD for the given instant in the device's local calendar. */
export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Parses YYYY-MM-DD as a local calendar date (not UTC midnight). */
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDayLabel(ymd: string): { weekday: string; day: string; month: string } {
  const date = parseYmd(ymd);
  return {
    weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-IN', { month: 'short' }),
  };
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return `${date} · ${formatTime(iso)}`;
}

export function isPast(iso: string, now: number = Date.now()): boolean {
  return Date.parse(iso) <= now;
}

/** Google Calendar "add event" template link — no calendar permission needed. */
export function googleCalendarUrl(params: { title: string; start: string; end: string; details?: string }): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(params.title)}`,
    `dates=${fmt(params.start)}/${fmt(params.end)}`,
    params.details ? `details=${encodeURIComponent(params.details)}` : '',
  ]
    .filter(Boolean)
    .join('&');
  return `https://calendar.google.com/calendar/render?${q}`;
}
