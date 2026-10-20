/**
 * Response schemas for the CecureUs mobile API (contract: docs/API_CONTRACT.md).
 *
 * Every response is validated before use. Unknown fields are stripped, so even if
 * the server over-shares (e.g. password hashes), those values never reach app state.
 */
import { z } from 'zod';

const id = z.union([z.string().min(1), z.number()]).transform(String);
const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const isoDateTime = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date-time');
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Accepts either an array or a comma-separated string (legacy columns), returns trimmed unique values. */
const stringList = z
  .union([z.array(z.string()), z.string()])
  .nullish()
  .transform((v) => {
    const parts = Array.isArray(v) ? v : (v ?? '').split(',');
    return [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  });

const optionalNumber = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });

export const sessionModeSchema = z.enum(['audio', 'video', 'chat']);
export type SessionMode = z.infer<typeof sessionModeSchema>;

export const userTypeSchema = z.enum(['corporate', 'individual']);
export type UserType = z.infer<typeof userTypeSchema>;

// ---------- Auth ----------

export const otpRequestSchema = z.object({
  requestId: id,
  expiresInSeconds: z.number().int().positive(),
  resendAfterSeconds: z.number().int().nonnegative(),
});
export type OtpRequest = z.infer<typeof otpRequestSchema>;

export const userSchema = z.object({
  id,
  firstName: z.string(),
  lastName: optionalText,
  email: z.string().email(),
  mobile: optionalText,
  userType: userTypeSchema,
  companyName: optionalText,
  sessionsRemaining: optionalNumber,
  /** employee_list.emp_age — optional, set from Edit Profile. */
  age: optionalNumber,
});
export type User = z.infer<typeof userSchema>;

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: isoDateTime,
  user: userSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;

/** Proof that the sign-up email was verified; required for the next registration steps. */
export const registrationSchema = z.object({ registrationToken: z.string().min(1) });
export type Registration = z.infer<typeof registrationSchema>;

export type RegistrationDetails = {
  firstName: string;
  lastName: string | null;
  password: string;
  /** Corporate only: employee ID (employee_list.emp_companyid), usable as a sign-in ID. */
  employeeId: string | null;
};

// ---------- Reference data ----------

export const namedItemSchema = z.object({ id, name: z.string().min(1) });
export type NamedItem = z.infer<typeof namedItemSchema>;

// ---------- Counsellors ----------

export const counsellorSchema = z.object({
  id,
  name: z.string().min(1),
  title: optionalText,
  city: optionalText,
  experienceYears: optionalNumber,
  languages: stringList,
  expertise: stringList,
  about: optionalText,
  imageUrl: optionalText,
  rating: optionalNumber,
  sessionsCount: optionalNumber,
  modes: z
    .array(sessionModeSchema)
    .nullish()
    .transform((v): SessionMode[] => (v && v.length ? v : ['audio', 'video', 'chat'])),
});
export type Counsellor = z.infer<typeof counsellorSchema>;

export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextPage: z.number().int().positive().nullish().transform((v) => v ?? null),
  });
}
export type Page<T> = { items: T[]; nextPage: number | null };

export const slotSchema = z.object({ start: isoDateTime, end: isoDateTime });
export type Slot = z.infer<typeof slotSchema>;

export const availabilityDaySchema = z.object({ date: ymd, slots: z.array(slotSchema) });
export const availabilitySchema = z.object({
  timezone: z.string().min(1),
  days: z.array(availabilityDaySchema),
});
export type Availability = z.infer<typeof availabilitySchema>;

// ---------- Bookings ----------

export const bookingStatusSchema = z.enum(['pending', 'confirmed', 'cancelled', 'completed']);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const bookingSchema = z.object({
  id,
  counsellorId: id,
  counsellorName: z.string(),
  start: isoDateTime,
  end: isoDateTime,
  mode: sessionModeSchema,
  issue: optionalText,
  language: optionalText,
  status: bookingStatusSchema,
  joinUrl: optionalText,
  cancellable: z.boolean().nullish().transform((v) => v ?? false),
  notification: z
    .object({ sms: z.enum(['sent', 'queued', 'failed', 'not_required']) })
    .nullish()
    .transform((v) => v ?? null),
});
export type Booking = z.infer<typeof bookingSchema>;

// ---------- Content ----------

export const articleSummarySchema = z.object({
  id,
  title: z.string().min(1),
  category: optionalText,
  excerpt: optionalText,
  imageUrl: optionalText,
  readMinutes: optionalNumber,
  publishedAt: optionalText,
});
export type ArticleSummary = z.infer<typeof articleSummarySchema>;

export const articleSchema = articleSummarySchema.extend({ contentHtml: z.string() });
export type Article = z.infer<typeof articleSchema>;

export const videoSchema = z.object({
  id,
  title: z.string().min(1),
  category: optionalText,
  thumbnailUrl: optionalText,
  videoUrl: z.string().url(),
  durationSeconds: optionalNumber,
});
export type Video = z.infer<typeof videoSchema>;

// ---------- Assessments ----------

export const assessmentSummarySchema = z.object({
  id,
  title: z.string().min(1),
  description: optionalText,
  imageUrl: optionalText,
  questionCount: optionalNumber,
  estimatedMinutes: optionalNumber,
});
export type AssessmentSummary = z.infer<typeof assessmentSummarySchema>;

export const assessmentSchema = assessmentSummarySchema.extend({
  questions: z
    .array(
      z.object({
        id,
        text: z.string().min(1),
        options: z.array(z.object({ id, text: z.string().min(1) })).min(2),
      }),
    )
    .min(1),
});
export type Assessment = z.infer<typeof assessmentSchema>;

export const assessmentResultSchema = z.object({
  percentage: z.number().min(0).max(100),
  level: z.string().min(1),
  summary: optionalText,
});
export type AssessmentResult = z.infer<typeof assessmentResultSchema>;

export const okSchema = z.unknown().transform(() => true as const);
