import * as SecureStore from 'expo-secure-store';

import { createApiClient } from '@/api/client';
import { createEndpoints } from '@/api/endpoints';
import type { UserType } from '@/api/schemas';
import { sessionStore } from '@/auth/session-store';

import { createMockServer, type MockServerOptions } from './mock-server';

export const APP_DIR = './src/app';

/** Routes all app network traffic to a fresh in-memory mock server. */
export function installMockServer(opts?: MockServerOptions) {
  const server = createMockServer(opts);
  globalThis.fetch = server.fetch;
  return server;
}

export function resetDeviceStorage() {
  (SecureStore as unknown as { __store: Map<string, string> }).__store.clear();
}

/** Creates a real session on the mock server and stores it like a completed login would. */
export async function signInDirect(
  server: ReturnType<typeof createMockServer>,
  userType: UserType = 'corporate',
  email = 'harsha@fixturecorp.com',
) {
  const api = createEndpoints(
    createApiClient({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL!,
      getAccessToken: async () => null,
      fetchImpl: server.fetch,
    }),
  );
  const otp = await api.auth.requestOtp(email, userType);
  const session = await api.auth.verifyOtp(otp.requestId, email, '123456');
  await sessionStore.save(session);
  server.state.calls.length = 0;
  server.state.lastOtpByEmail.clear();
  return session;
}
