import { sessionStore } from '@/auth/session-store';
import { getEnv } from '@/config/env';

import { createApiClient } from './client';
import { createEndpoints, type Endpoints } from './endpoints';

let unauthorizedHandler: (() => void) | null = null;
let instance: Endpoints | null = null;

/** Register the single handler invoked when the server rejects the session (401). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

/**
 * Demo mode (development only): route all API calls to the in-app fake backend.
 * The check reads process.env directly so production builds, where the variable is
 * unset, compile the branch away and never bundle the mock server.
 */
const DEMO_DB_KEY = 'cecureus.demo.db.v1';

function demoFetch(baseUrl: string): typeof fetch | undefined {
  if (process.env.EXPO_PUBLIC_DEMO_MODE === 'true' && process.env.EXPO_PUBLIC_APP_ENV === 'development') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMockServer } = require('@/test/mock-server') as typeof import('@/test/mock-server');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readJson, writeJson } = require('@/local/secure-json-store') as typeof import('@/local/secure-json-store');
    const server = createMockServer({ baseUrl, seedDemoAccount: true });
    // Keep demo accounts, sessions and bookings across app reloads (stored on this device only).
    const ready = readJson<ReturnType<typeof server.snapshot> | null>(DEMO_DB_KEY, null)
      .then((snap) => {
        if (snap) server.restore(snap);
      })
      .catch(() => undefined);
    return (async (input, init) => {
      await ready;
      const response = await server.fetch(input, init);
      if ((init?.method ?? 'GET').toUpperCase() !== 'GET') {
        void writeJson(DEMO_DB_KEY, server.snapshot()).catch(() => undefined);
      }
      return response;
    }) as typeof fetch;
  }
  return undefined;
}

/** Lazily creates the production API so a bad env config surfaces as a screen, not a crash at import. */
export function getApi(): Endpoints {
  if (!instance) {
    const env = getEnv();
    const client = createApiClient({
      baseUrl: env.apiBaseUrl,
      fetchImpl: demoFetch(env.apiBaseUrl),
      getAccessToken: () => sessionStore.getToken(),
      onUnauthorized: () => unauthorizedHandler?.(),
    });
    instance = createEndpoints(client);
  }
  return instance;
}

export { ApiError, friendlyMessage } from './errors';
export type { Endpoints } from './endpoints';
