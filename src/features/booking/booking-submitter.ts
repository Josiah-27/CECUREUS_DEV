import { randomUUID } from 'expo-crypto';

import type { Endpoints } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import type { Booking, SessionMode } from '@/api/schemas';

export type BookingInput = {
  counsellorId: string;
  slotStart: string;
  mode: SessionMode;
  issueId: string | null;
  language: string | null;
  notes: string | null;
};

export type SubmitResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: 'slot_unavailable' | 'slot_in_past' | 'in_flight' | 'error'; error?: unknown };

const SLOT_CODES = new Set(['SLOT_UNAVAILABLE', 'SLOT_TAKEN', 'DUPLICATE_BOOKING']);

/**
 * Submits bookings with an Idempotency-Key that is stable across retries of the
 * *same* request, so a timeout + retry can never create two bookings or send two SMS.
 * Any change to the request (slot, mode, notes…) gets a fresh key.
 */
export function createBookingSubmitter(api: Endpoints, now: () => number = Date.now) {
  let current: { signature: string; key: string } | null = null;
  let inFlight = false;

  function keyFor(input: BookingInput): string {
    const signature = JSON.stringify(input);
    if (!current || current.signature !== signature) current = { signature, key: randomUUID() };
    return current.key;
  }

  return {
    get inFlight() {
      return inFlight;
    },
    /** Exposed for tests/diagnostics only. */
    peekKey: () => current?.key ?? null,

    async submit(input: BookingInput): Promise<SubmitResult> {
      if (inFlight) return { ok: false, reason: 'in_flight' };
      if (Date.parse(input.slotStart) <= now()) return { ok: false, reason: 'slot_in_past' };
      inFlight = true;
      const key = keyFor(input);
      try {
        const booking = await api.bookings.create(input, key);
        current = null; // A later booking must not reuse this key.
        return { ok: true, booking };
      } catch (error) {
        if (error instanceof ApiError && (error.kind === 'conflict' || (error.code && SLOT_CODES.has(error.code)))) {
          current = null;
          return { ok: false, reason: 'slot_unavailable', error };
        }
        // Keep the key: a retry of this exact request must be de-duplicated server-side.
        return { ok: false, reason: 'error', error };
      } finally {
        inFlight = false;
      }
    },
  };
}

export type BookingSubmitter = ReturnType<typeof createBookingSubmitter>;
