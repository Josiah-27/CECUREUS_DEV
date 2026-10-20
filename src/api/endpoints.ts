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
  registrationSchema,
  userSchema,
  videoSchema,
  type RegistrationDetails,
  type SessionMode,
  type UserType,
} from './schemas';

export function createEndpoints(client: ApiClient) {
  return {
    auth: {
      /** Sign in with a user ID (email, mobile number or employee ID) and password. */
      login: (userId: string, password: string) =>
        client.request('auth/login', authSessionSchema, {
          method: 'POST',
          auth: false,
          body: { userId, password },
        }),
      logout: () => client.request('auth/logout', okSchema, { method: 'POST' }),
      register: {
        requestEmailOtp: (email: string, userType: UserType) =>
          client.request('auth/register/email/request', otpRequestSchema, {
            method: 'POST',
            auth: false,
            body: { email, userType },
          }),
        verifyEmailOtp: (requestId: string, otp: string) =>
          client.request('auth/register/email/verify', registrationSchema, {
            method: 'POST',
            auth: false,
            body: { requestId, otp },
          }),
        requestPhoneOtp: (registrationToken: string, mobile: string) =>
          client.request('auth/register/phone/request', otpRequestSchema, {
            method: 'POST',
            auth: false,
            body: { registrationToken, mobile },
          }),
        verifyPhoneOtp: (registrationToken: string, requestId: string, otp: string) =>
          client.request('auth/register/phone/verify', okSchema, {
            method: 'POST',
            auth: false,
            body: { registrationToken, requestId, otp },
          }),
        complete: (registrationToken: string, details: RegistrationDetails) =>
          client.request('auth/register/complete', authSessionSchema, {
            method: 'POST',
            auth: false,
            body: { registrationToken, ...details },
          }),
      },
    },

    profile: {
      get: () => client.request('me', userSchema),
      update: (patch: { firstName: string; lastName: string | null; age: number | null }) =>
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
