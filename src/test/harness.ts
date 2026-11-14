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
  /** 10-digit number as stored in employee_list.emp_mobile. */
  mobile?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
};

/** Adds the person to employee_list (as the CecureUs team does), then signs in via SMS OTP. */
export async function registerDirect(server: ReturnType<typeof createMockServer>, account: TestAccount = {}) {
  const {
    userType = 'corporate',
    email = 'harsha@fixturecorp.com',
    mobile = '9876543210',
    firstName = 'Harsha',
    lastName = 'Verma',
    status = 'Active',
  } = account;
  server.addEmployee({
    emp_name: firstName,
    emp_lname: lastName,
    emp_email: email,
    emp_mobile: mobile,
    emp_option: userType === 'corporate' ? 'Corporate' : 'Individual',
    emp_companyname: userType === 'corporate' ? 'Fixture Corp' : '',
    status,
  });
  const api = createEndpoints(
    createApiClient({
      baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL!,
      getAccessToken: async () => null,
      fetchImpl: server.fetch,
    }),
  );
  const otp = await api.auth.requestOtp(`+91${mobile}`);
  return api.auth.verifyOtp(otp.requestId, '123456');
}

/** Creates an account on the mock server and stores the session like a completed sign-in would. */
export async function signInDirect(
  server: ReturnType<typeof createMockServer>,
  userType: UserType = 'corporate',
  email = userType === 'corporate' ? 'harsha@fixturecorp.com' : 'solo@example.com',
) {
  const session = await registerDirect(server, {
    userType,
    email,
    mobile: userType === 'corporate' ? '9876543210' : '9812345678',
  });
  await sessionStore.save(session);
  // Start each test with clean logs: sign-in itself sends an SMS.
  server.state.calls.length = 0;
  server.state.otps.clear();
  server.state.smsLog.length = 0;
  server.state.emailLog.length = 0;
  return session;
}
