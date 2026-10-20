import { z } from 'zod';

import { createMockServer } from '@/test/mock-server';

import { createApiClient } from '../client';
import { ApiError, friendlyMessage } from '../errors';

const BASE = 'https://api.test.cecureus.local/v1';

function setup(token: string | null = 'tok') {
  const server = createMockServer();
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    baseUrl: BASE,
    getAccessToken: async () => token,
    onUnauthorized,
    fetchImpl: server.fetch,
  });
  return { server, client, onUnauthorized };
}

async function catchError(p: Promise<unknown>): Promise<ApiError> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
  throw new Error('Expected promise to reject');
}

describe('createApiClient', () => {
  it('unwraps the success envelope and validates the payload', async () => {
    const { client } = setup(null);
    const data = await client.request('issues', z.array(z.object({ id: z.number(), name: z.string() })), {
      auth: false,
    });
    expect(data).toEqual([
      { id: 1, name: 'Stress' },
      { id: 2, name: 'Anxiety' },
    ]);
  });

  it('builds query strings, dropping empty values and encoding', async () => {
    const { client, server } = setup(null);
    server.state.failNext = { status: 200, body: { status: true, data: [] } };
    await client.request('counsellors', z.array(z.unknown()), {
      auth: false,
      query: { search: 'a&b c', page: 2, empty: '', none: undefined },
    });
    expect(server.state.calls[0].url).toBe(`${BASE}/counsellors?search=a%26b%20c&page=2`);
  });

  it('sends Authorization and Idempotency-Key headers', async () => {
    const { client, server } = setup('secret-token');
    server.state.failNext = { status: 200, body: { status: true, data: null } };
    await client.request('bookings', z.null(), { method: 'POST', body: {}, idempotencyKey: 'key-1' });
    expect(server.state.calls[0].headers.Authorization).toBe('Bearer secret-token');
    expect(server.state.calls[0].headers['Idempotency-Key']).toBe('key-1');
  });

  it('refuses an authenticated call with no token without hitting the network', async () => {
    const { client, server } = setup(null);
    const err = await catchError(client.request('me', z.unknown()));
    expect(err.kind).toBe('unauthorized');
    expect(server.state.calls).toHaveLength(0);
  });

  it('maps 401 to unauthorized and notifies the session handler', async () => {
    const { client, onUnauthorized } = setup('expired-token');
    const err = await catchError(client.request('me', z.unknown()));
    expect(err.kind).toBe('unauthorized');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('maps network failures', async () => {
    const { client, server } = setup(null);
    server.state.failNext = 'network';
    const err = await catchError(client.request('issues', z.unknown(), { auth: false }));
    expect(err.kind).toBe('network');
    expect(err.retryable).toBe(true);
  });

  it('times out slow requests', async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const client = createApiClient({ baseUrl: BASE, getAccessToken: async () => null, fetchImpl: hang });
    const err = await catchError(client.request('issues', z.unknown(), { auth: false, timeoutMs: 20 }));
    expect(err.kind).toBe('timeout');
  });

  it('reports cancellation distinctly from timeouts', async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    const client = createApiClient({ baseUrl: BASE, getAccessToken: async () => null, fetchImpl: hang });
    const controller = new AbortController();
    const p = client.request('issues', z.unknown(), { auth: false, signal: controller.signal });
    controller.abort();
    expect((await catchError(p)).kind).toBe('cancelled');
  });

  it('maps HTTP status codes and carries server code and Retry-After', async () => {
    const { client, server } = setup(null);
    await client.request('auth/otp/request', z.unknown(), {
      method: 'POST',
      auth: false,
      body: { email: 'a@b.co', userType: 'individual' },
    });
    const err = await catchError(
      client.request('auth/otp/request', z.unknown(), {
        method: 'POST',
        auth: false,
        body: { email: 'a@b.co', userType: 'individual' },
      }),
    );
    expect(err.kind).toBe('rate_limited');
    expect(err.code).toBe('OTP_COOLDOWN');
    expect(err.retryAfterSeconds).toBeGreaterThan(0);
    expect(server.state.calls).toHaveLength(2);
  });

  it.each([
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'validation'],
    [500, 'server'],
    [503, 'server'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const { client, server } = setup(null);
    server.state.failNext = { status, body: { status: false, message: 'msg' } };
    expect((await catchError(client.request('issues', z.unknown(), { auth: false }))).kind).toBe(kind);
  });

  it('treats a 200 with status:false as a business error', async () => {
    const { client, server } = setup(null);
    server.state.failNext = { status: 200, body: { status: false, message: 'Slot taken', code: 'SLOT' } };
    const err = await catchError(client.request('issues', z.unknown(), { auth: false }));
    expect(err.kind).toBe('validation');
    expect(err.message).toBe('Slot taken');
  });

  it('rejects responses that do not match the schema', async () => {
    const { client, server } = setup(null);
    server.state.failNext = { status: 200, body: { status: true, data: [{ wrong: true }] } };
    const err = await catchError(
      client.request('issues', z.array(z.object({ id: z.number() })), { auth: false }),
    );
    expect(err.kind).toBe('invalid_response');
  });

  it('handles non-JSON error bodies (e.g. an HTML 403 page)', async () => {
    const htmlFetch: typeof fetch = async () => new Response('<html>Forbidden</html>', { status: 403 });
    const client = createApiClient({ baseUrl: BASE, getAccessToken: async () => null, fetchImpl: htmlFetch });
    const err = await catchError(client.request('issues', z.unknown(), { auth: false }));
    expect(err.kind).toBe('forbidden');
    expect(friendlyMessage(err)).toMatch(/access/);
  });
});

describe('friendlyMessage', () => {
  it('shows server text only for validation errors', () => {
    expect(friendlyMessage(new ApiError('validation', 'Name is required'))).toBe('Name is required');
    expect(friendlyMessage(new ApiError('server', 'SQLSTATE[42S22] leaked detail'))).not.toMatch(/SQL/);
    expect(friendlyMessage(new Error('boom'))).toMatch(/went wrong/);
  });
});
