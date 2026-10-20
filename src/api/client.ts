import { z } from 'zod';

import { ApiError, kindForStatus } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Attach the bearer token. Defaults to true. */
  auth?: boolean;
  /** Sent as Idempotency-Key so the server can de-duplicate retried writes. */
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type ApiClientConfig = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  /** Called once when an authenticated request returns 401. */
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** Standard response envelope used by the CecureUs backend: `{ status, data, message?, code? }`. */
const failureEnvelope = z.object({
  status: z.literal(false).optional(),
  message: z.string().optional(),
  code: z.string().optional(),
});

export type ApiClient = {
  request<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, opts?: RequestOptions): Promise<T>;
};

function buildUrl(baseUrl: string, path: string, query?: RequestOptions['query']): string {
  const url = `${baseUrl}/${path.replace(/^\/+/, '')}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  // Resolved per request so tests (and instrumentation) can swap the global fetch.
  const fetchImpl: typeof fetch = (input, init) => (config.fetchImpl ?? globalThis.fetch)(input, init);
  const defaultTimeout = config.timeoutMs ?? 15000;

  async function request<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, opts: RequestOptions = {}) {
    const { method = 'GET', body, query, auth = true, idempotencyKey, signal } = opts;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    if (auth) {
      const token = await config.getAccessToken();
      if (!token) throw new ApiError('unauthorized', 'Not signed in', { status: 401 });
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, opts.timeoutMs ?? defaultTimeout);
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort);

    let res: Response;
    try {
      res = await fetchImpl(buildUrl(config.baseUrl, path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (timedOut) throw new ApiError('timeout', 'Request timed out');
      if (signal?.aborted) throw new ApiError('cancelled', 'Request cancelled');
      throw new ApiError('network', 'Network request failed');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }

    const json = await readJson(res);

    if (!res.ok) {
      const parsed = failureEnvelope.safeParse(json);
      const retryAfter = Number(res.headers.get('Retry-After'));
      const kind = kindForStatus(res.status);
      if (kind === 'unauthorized' && auth) config.onUnauthorized?.();
      throw new ApiError(kind, parsed.success ? (parsed.data.message ?? '') : '', {
        status: res.status,
        code: parsed.success ? parsed.data.code : undefined,
        retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
      });
    }

    // 2xx with `status: false` is how the legacy backend reports business errors.
    if (json && typeof json === 'object' && (json as { status?: unknown }).status === false) {
      const parsed = failureEnvelope.safeParse(json);
      throw new ApiError('validation', parsed.success ? (parsed.data.message ?? '') : '', {
        status: res.status,
        code: parsed.success ? parsed.data.code : undefined,
      });
    }

    const envelope = z.object({ status: z.literal(true), data: schema }).safeParse(json);
    if (!envelope.success) {
      throw new ApiError('invalid_response', 'Response did not match the expected contract', {
        status: res.status,
      });
    }
    // zod widens generic payloads to optional; the schema above has already validated it.
    return envelope.data.data as T;
  }

  return { request };
}
