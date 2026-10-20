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

/** Lazily creates the production API so a bad env config surfaces as a screen, not a crash at import. */
export function getApi(): Endpoints {
  if (!instance) {
    const client = createApiClient({
      baseUrl: getEnv().apiBaseUrl,
      getAccessToken: () => sessionStore.getToken(),
      onUnauthorized: () => unauthorizedHandler?.(),
    });
    instance = createEndpoints(client);
  }
  return instance;
}

export { ApiError, friendlyMessage } from './errors';
export type { Endpoints } from './endpoints';
