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

export type TestAccount = {
  userType?: UserType;
  email?: string;
  mobile?: string;
  firstName?: string;
  lastName?: string | null;
  password?: string;
  employeeId?: string | null;
};

export const TEST_PASSWORD = 'Secret123';

/** Registers through the real sign-up endpoints (email OTP → mobile OTP → details); returns the session. */
export async function registerDirect(server: ReturnType<typeof createMockServer>, account: TestAccount = {}) {
  const {
    userType = 'corporate',
    email = 'harsha@fixturecorp.com',
    mobile = '+919876543210',
    firstName = 'Harsha',
    lastName = 'Verma',
    password = TEST_PASSWORD,
    employeeId = null,
  } = account;
  const api = createEndpoints(
    createApiClient({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL!,
      getAccessToken: async () => null,
      fetchImpl: server.fetch,
    }),
  );
  const emailOtp = await api.auth.register.requestEmailOtp(email, userType);
  const { registrationToken } = await api.auth.register.verifyEmailOtp(emailOtp.requestId, '123456');
  const phoneOtp = await api.auth.register.requestPhoneOtp(registrationToken, mobile);
  await api.auth.register.verifyPhoneOtp(registrationToken, phoneOtp.requestId, '123456');
  return api.auth.register.complete(registrationToken, { firstName, lastName, password, employeeId });
}

/** Creates an account on the mock server and stores the session like a completed sign-up would. */
export async function signInDirect(
  server: ReturnType<typeof createMockServer>,
  userType: UserType = 'corporate',
  email = userType === 'corporate' ? 'harsha@fixturecorp.com' : 'solo@example.com',
) {
  const session = await registerDirect(server, {
    userType,
    email,
    mobile: userType === 'corporate' ? '+919876543210' : '+919812345678',
  });
  await sessionStore.save(session);
  // Start each test with clean logs: sign-up itself sends a verification email and SMS.
  server.state.calls.length = 0;
  server.state.otps.clear();
  server.state.smsLog.length = 0;
  server.state.emailLog.length = 0;
  return session;
}
