/**
 * Typed endpoint functions. Paths follow docs/API_CONTRACT.md (proposed contract,
 * pending confirmation by the backend team — see BACKEND_BLOCKERS.md).
 */
import { z } from 'zod';

import type { ApiClient } from './client';
import {
  articleSchema,
  articleSummarySchema,
  assessmentResultSchema,
  assessmentSchema,
  assessmentSummarySchema,
  authSessionSchema,
  availabilitySchema,
  bookingSchema,
  counsellorSchema,
  namedItemSchema,
  okSchema,
  otpRequestSchema,
  pageSchema,
  userSchema,
  videoSchema,
  type SessionMode,
  type UserType,
} from './schemas';

export function createEndpoints(client: ApiClient) {
  return {
    auth: {
      requestOtp: (email: string, userType: UserType) =>
        client.request('auth/otp/request', otpRequestSchema, {
          method: 'POST',
          auth: false,
          body: { email, userType },
        }),
      verifyOtp: (requestId: string, email: string, otp: string) =>
        client.request('auth/otp/verify', authSessionSchema, {
          method: 'POST',
          auth: false,
          body: { requestId, email, otp },
        }),
      logout: () => client.request('auth/logout', okSchema, { method: 'POST' }),
    },

    profile: {
      get: () => client.request('me', userSchema),
      update: (patch: { firstName: string; lastName: string | null; mobile: string | null }) =>
        client.request('me', userSchema, { method: 'PATCH', body: patch }),
      requestDeletion: () => client.request('me', okSchema, { method: 'DELETE' }),
    },

    reference: {
      issues: () => client.request('issues', z.array(namedItemSchema)),
      languages: () => client.request('languages', z.array(namedItemSchema)),
    },

    counsellors: {
      list: (params: { search?: string; expertise?: string; page?: number }, signal?: AbortSignal) =>
        client.request('counsellors', pageSchema(counsellorSchema), { query: params, signal }),
      get: (id: string) => client.request(`counsellors/${encodeURIComponent(id)}`, counsellorSchema),
      availability: (id: string, from: string, to: string) =>
        client.request(`counsellors/${encodeURIComponent(id)}/availability`, availabilitySchema, {
          query: { from, to },
        }),
    },

    bookings: {
      create: (
        input: {
          counsellorId: string;
          slotStart: string;
          mode: SessionMode;
          issueId: string | null;
          language: string | null;
          notes: string | null;
        },
        idempotencyKey: string,
      ) =>
        client.request('bookings', bookingSchema, {
          method: 'POST',
          body: input,
          idempotencyKey,
          // Booking writes get a longer timeout; a timeout is retried with the same key.
          timeoutMs: 30000,
        }),
      list: (page?: number) => client.request('bookings', pageSchema(bookingSchema), { query: { page } }),
      cancel: (id: string, reason: string) =>
        client.request(`bookings/${encodeURIComponent(id)}/cancel`, bookingSchema, {
          method: 'POST',
          body: { reason },
        }),
    },

    content: {
      articles: (params: { category?: string; search?: string; page?: number }) =>
        client.request('articles', pageSchema(articleSummarySchema), { query: params }),
      article: (id: string) => client.request(`articles/${encodeURIComponent(id)}`, articleSchema),
      videos: (params: { category?: string; page?: number }) =>
        client.request('videos', pageSchema(videoSchema), { query: params }),
    },

    assessments: {
      list: () => client.request('assessments', z.array(assessmentSummarySchema)),
      get: (id: string) => client.request(`assessments/${encodeURIComponent(id)}`, assessmentSchema),
      submit: (id: string, answers: { questionId: string; optionId: string }[]) =>
        client.request(`assessments/${encodeURIComponent(id)}/submit`, assessmentResultSchema, {
          method: 'POST',
          body: { answers },
        }),
    },
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
