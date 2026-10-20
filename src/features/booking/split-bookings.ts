import type { Booking } from '@/api/schemas';
import { isPast } from '@/lib/date';

/** Upcoming = active (confirmed/pending) and not yet ended, soonest first; everything else is past, newest first. */
export function splitBookings(items: Booking[], now: number = Date.now()) {
  const upcoming = items
    .filter((b) => (b.status === 'confirmed' || b.status === 'pending') && !isPast(b.end, now))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const past = items
    .filter((b) => !upcoming.includes(b))
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  return { upcoming, past };
}
