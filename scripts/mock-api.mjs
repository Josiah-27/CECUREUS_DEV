/**
 * Local HTTP wrapper around the in-memory mock API (src/test/mock-server.ts) for
 * UI preview and manual testing without a backend. NEVER points at real data.
 *
 *   npm run mock-api            # http://localhost:4000/v1
 *   EXPO_PUBLIC_API_BASE_URL=http://localhost:4000/v1 npm run web
 *
 * Sign up with any email (OTP is always 123456), or sign in with the demo account
 * harsha.verma@example.com / Harsha@123.
 */
import http from 'node:http';

const PORT = Number(process.env.MOCK_API_PORT ?? 4000);
process.env.EXPO_PUBLIC_API_BASE_URL = `http://localhost:${PORT}/v1`;

const { createMockServer } = await import('../src/test/mock-server.ts');
const mock = createMockServer({ seedDemoAccount: true });

const HEADER_CASE = { authorization: 'Authorization', 'idempotency-key': 'Idempotency-Key', 'content-type': 'Content-Type' };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, Accept',
  'Access-Control-Expose-Headers': 'Retry-After',
};

http
  .createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS).end();
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (HEADER_CASE[k]) headers[HEADER_CASE[k]] = String(v);
    const body = chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined;
    const response = await mock.fetch(`http://localhost:${PORT}${req.url}`, { method: req.method, headers, body });
    const out = { ...CORS, 'Content-Type': 'application/json' };
    const retry = response.headers.get('Retry-After');
    if (retry) out['Retry-After'] = retry;
    res.writeHead(response.status, out).end(await response.text());
    process.stdout.write(`${req.method} ${req.url} -> ${response.status}\n`);
  })
  .listen(PORT, () => process.stdout.write(`Mock CecureUs API on http://localhost:${PORT}/v1 (OTP: 123456)\n`));
