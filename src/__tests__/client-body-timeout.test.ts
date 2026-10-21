
import { z } from 'zod';

import { createApiClient } from '../client';
import { ApiError } from '../errors';

const BASE = 'https://api.test.cecureus.local/v1';

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected request to fail');
}

/**
 * Simulates a server that sends response headers immediately,
 * but stalls while streaming the response body.
 *
 * The fallback prevents a regression from hanging the entire test suite.
 */
function stalledBodyFetch(): typeof fetch {
  return async (_input, init) =>
    ({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () =>
        new Promise<string>((_resolve, reject) => {
          const fallback = setTimeout(() => {
            reject(new Error('Response body stalled'));
          }, 150);

          const onAbort = () => {
            clearTimeout(fallback);
            reject(new Error('Response body aborted'));
          };

          if (init?.signal?.aborted) {
            onAbort();
          } else {
            init?.signal?.addEventListener('abort', onAbort, { once: true });
          }
        }),
    }) as Response;
}

describe('API response body timeout', () => {
  it('times out when headers arrive but the body stalls', async () => {
    const client = createApiClient({
      baseUrl: BASE,
      getAccessToken: async () => null,
      fetchImpl: stalledBodyFetch(),
    });

    const error = await catchError(
      client.request('issues', z.unknown(), {
        auth: false,
        timeoutMs: 20,
      }),
    );

    expect(error.kind).toBe('timeout');
    expect(error.message).toBe('Request timed out');
  });

  it('reports cancellation while reading the response body', async () => {
    const controller = new AbortController();

    const client = createApiClient({
      baseUrl: BASE,
      getAccessToken: async () => null,
      fetchImpl: stalledBodyFetch(),
    });

    const request = client.request('issues', z.unknown(), {
      auth: false,
      signal: controller.signal,
      timeoutMs: 1000,
    });

    controller.abort();

    const error = await catchError(request);

    expect(error.kind).toBe('cancelled');
    expect(error.message).toBe('Request cancelled');
  });

  it('still accepts a valid, complete JSON response', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          status: true,
          data: ['Stress', 'Anxiety'],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );

    const client = createApiClient({
      baseUrl: BASE,
      getAccessToken: async () => null,
      fetchImpl,
    });

    const result = await client.request(
      'issues',
      z.array(z.string()),
      { auth: false },
    );

    expect(result).toEqual(['Stress', 'Anxiety']);
  });
});
