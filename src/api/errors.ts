export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'invalid_response'
  | 'cancelled';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  /** Machine-readable code from the backend, e.g. OTP_EXPIRED, SLOT_UNAVAILABLE. */
  readonly code?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts: { status?: number; code?: string; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = opts.status;
    this.code = opts.code;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }

  /** Whether the same request may be safely retried by the user. */
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server';
  }
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  return 'server';
}

const FRIENDLY: Record<ApiErrorKind, string> = {
  network: "You appear to be offline. Check your connection and try again.",
  timeout: 'The server took too long to respond. Please try again.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find what you were looking for.",
  conflict: 'This was changed by someone else. Please refresh and try again.',
  validation: 'Some of the details entered are not valid.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  server: 'Something went wrong on our side. Please try again shortly.',
  invalid_response: 'We received an unexpected response. Please try again later.',
  cancelled: 'The request was cancelled.',
};

/** User-facing message. Server messages are shown only for validation-type errors. */
export function friendlyMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if ((err.kind === 'validation' || err.kind === 'conflict') && err.message) return err.message;
    return FRIENDLY[err.kind];
  }
  return FRIENDLY.server;
}
