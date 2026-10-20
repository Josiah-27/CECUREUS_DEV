import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { createApiClient } from '@/api/client';
import { createEndpoints } from '@/api/endpoints';
import { sessionStore } from '@/auth/session-store';
import { APP_DIR, installMockServer, registerDirect, resetDeviceStorage, signInDirect, TEST_PASSWORD } from '@/test/harness';
import {
  EMPLOYEE_LIST_COLUMNS,
  LOGIN_MAX_ATTEMPTS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_MS,
  OTP_TTL_MS,
  type MockServer,
} from '@/test/mock-server';

let server: MockServer;

beforeEach(() => {
  resetDeviceStorage();
  server = installMockServer();
});

afterEach(() => {
  jest.useRealTimers();
});

const callsTo = (path: string) => server.state.calls.filter((c) => c.path === path);

async function startRegistration(type: 'individual' | 'corporate' = 'individual') {
  renderRouter(APP_DIR, { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  fireEvent.press(await screen.findByTestId(`choose-${type}`));
  await screen.findByTestId('register-email');
}

async function sendEmailCode(email: string) {
  fireEvent.changeText(screen.getByTestId('register-email'), email);
  fireEvent.press(screen.getByTestId('send-email-code'));
  return screen.findByTestId('otp-input');
}

async function verifyEmail(email: string) {
  fireEvent.changeText(await sendEmailCode(email), '123456');
  await screen.findByTestId('register-mobile');
}

async function verifyPhone(mobile: string) {
  fireEvent.changeText(screen.getByTestId('register-mobile'), mobile);
  fireEvent.press(screen.getByTestId('send-phone-code'));
  fireEvent.changeText(await screen.findByTestId('otp-input'), '123456');
  await screen.findByTestId('register-first-name');
}

async function enterName(first: string, last: string, employeeId?: string) {
  fireEvent.changeText(screen.getByTestId('register-first-name'), first);
  fireEvent.changeText(screen.getByTestId('register-last-name'), last);
  if (employeeId) fireEvent.changeText(screen.getByTestId('register-employee-id'), employeeId);
  fireEvent.press(screen.getByTestId('register-name-next'));
  await screen.findByTestId('register-password');
}

function submitPassword(password: string, confirm = password) {
  fireEvent.changeText(screen.getByTestId('register-password'), password);
  fireEvent.changeText(screen.getByTestId('register-confirm'), confirm);
  fireEvent.press(screen.getByTestId('create-account'));
}

async function openSignIn() {
  renderRouter(APP_DIR, { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('have-account'));
  await screen.findByTestId('signin-user-id');
}

function signIn(userId: string, password: string) {
  fireEvent.changeText(screen.getByTestId('signin-user-id'), userId);
  fireEvent.changeText(screen.getByTestId('signin-password'), password);
  fireEvent.press(screen.getByTestId('signin-submit'));
}

describe('entry points', () => {
  it('Get Started asks corporate or individual; "I already have an account" asks user ID and password', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Your Mental Health Matters')).toBeOnTheScreen();
    expect(screen.getByTestId('emergency-banner')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId('get-started'));
    expect(await screen.findByText('I am a Corporate Employee')).toBeOnTheScreen();
    expect(screen.getByText('I am an Individual')).toBeOnTheScreen();
  });

  it('opens sign in from the splash and can switch to account creation', async () => {
    await openSignIn();
    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
    expect(screen.getByTestId('signin-password')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('go-register'));
    expect(await screen.findByText('I am an Individual')).toBeOnTheScreen();
  });
});

describe('individual sign-up: email OTP → mobile OTP → name → password', () => {
  it('creates the account in employee_list (unchanged columns) and signs in', async () => {
    await startRegistration('individual');
    expect(screen.getByTestId('register-step')).toHaveTextContent('Step 1 of 4 · Verify email');
    await verifyEmail('Asha.Rao@Example.com');
    expect(screen.getByTestId('register-step')).toHaveTextContent('Step 2 of 4 · Verify mobile');
    await verifyPhone('98123 45678');
    expect(screen.getByTestId('register-step')).toHaveTextContent('Step 3 of 4 · About you');
    await enterName('Asha', 'Rao');
    expect(screen.getByTestId('register-step')).toHaveTextContent('Step 4 of 4 · Set password');
    expect(screen.getByTestId('register-user-id')).toHaveTextContent(/asha\.rao@example\.com.*\+91 98123 45678/);
    submitPassword('Secret123');

    expect(await screen.findByText('Hi, Asha 👋')).toBeOnTheScreen();

    const row = server.state.employee_list.find((r) => r.emp_email === 'asha.rao@example.com')!;
    expect(Object.keys(row).sort()).toEqual([...EMPLOYEE_LIST_COLUMNS].sort()); // database structure unchanged
    expect(row).toMatchObject({
      emp_name: 'Asha',
      emp_lname: 'Rao',
      emp_mobile: '+919812345678',
      emp_role: 'individual',
      emp_otp: '',
      emp_companyid: '',
      status: 'active',
    });
    expect(row.emp_password).toBeTruthy();
    expect(row.emp_password).not.toBe('Secret123');
    expect(Object.values(row).every((v) => typeof v === 'string' || typeof v === 'number')).toBe(true);

    const stored = await sessionStore.load();
    expect(stored?.user).toMatchObject({ firstName: 'Asha', mobile: '+919812345678', userType: 'individual', age: null });
    expect(JSON.stringify(stored)).not.toMatch(/Secret123|mock\$/);
    expect(JSON.stringify(server.state.calls.map((c) => c.headers))).not.toContain('Secret123');
  });

  it('validates the email before calling the server', async () => {
    await startRegistration();
    fireEvent.changeText(screen.getByTestId('register-email'), 'not-an-email');
    fireEvent.press(screen.getByTestId('send-email-code'));
    expect(await screen.findByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(server.state.calls).toHaveLength(0);
  });

  it('rejects a wrong email code and stays on step 1', async () => {
    await startRegistration();
    fireEvent.changeText(await sendEmailCode('new@example.com'), '000000');
    expect(await screen.findByText('Incorrect code. Please try again.')).toBeOnTheScreen();
    expect(screen.getByTestId('register-step')).toHaveTextContent(/Step 1 of 4/);
    expect(screen.queryByTestId('register-mobile')).toBeNull();
  });

  it('rejects an expired code (expiry enforced by the server)', async () => {
    await startRegistration();
    const input = await sendEmailCode('new@example.com');
    server.state.otps.forEach((o) => (o.issuedAt -= OTP_TTL_MS + 1000));
    fireEvent.changeText(input, '123456');
    expect(await screen.findByText('This code has expired. Please request a new one.')).toBeOnTheScreen();
  });

  it('disables verification once the code expires on the client', async () => {
    await startRegistration();
    await sendEmailCode('new@example.com');
    act(() => {
      jest.advanceTimersByTime(OTP_TTL_MS + 1000);
    });
    expect(await screen.findByText('This code has expired. Request a new one.')).toBeOnTheScreen();
    expect(screen.getByTestId('verify-code')).toBeDisabled();
  });

  it('enforces the resend cooldown, then sends a new code', async () => {
    await startRegistration();
    await sendEmailCode('new@example.com');
    expect(screen.getByTestId('resend-code')).toBeDisabled();
    act(() => {
      jest.advanceTimersByTime(OTP_RESEND_MS + 1000);
    });
    expect(await screen.findByText('Resend code')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('resend-code'));
    expect(await screen.findByText('A new code has been sent.')).toBeOnTheScreen();
    expect(callsTo('auth/register/email/request')).toHaveLength(2);
  });

  it('locks a code after repeated wrong attempts', async () => {
    await startRegistration();
    const input = await sendEmailCode('new@example.com');
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      fireEvent.changeText(input, '000000');
      await screen.findByText('Incorrect code. Please try again.');
    }
    fireEvent.changeText(input, '123456');
    expect(await screen.findByText(/Too many attempts/)).toBeOnTheScreen();
  });

  it('validates the mobile number and rejects a wrong SMS code', async () => {
    await startRegistration();
    await verifyEmail('new@example.com');
    fireEvent.changeText(screen.getByTestId('register-mobile'), '12345');
    fireEvent.press(screen.getByTestId('send-phone-code'));
    expect(await screen.findByText('Enter a valid 10-digit Indian mobile number.')).toBeOnTheScreen();
    expect(callsTo('auth/register/phone/request')).toHaveLength(0);

    fireEvent.changeText(screen.getByTestId('register-mobile'), '98123 45678');
    fireEvent.press(screen.getByTestId('send-phone-code'));
    fireEvent.changeText(await screen.findByTestId('otp-input'), '999999');
    expect(await screen.findByText('Incorrect code. Please try again.')).toBeOnTheScreen();
    expect(screen.queryByTestId('register-first-name')).toBeNull();
  });

  it('tells the user an email is already registered and offers sign in', async () => {
    await registerDirect(server, { userType: 'individual', email: 'taken@example.com', mobile: '+919800000001' });
    await startRegistration();
    fireEvent.changeText(screen.getByTestId('register-email'), 'taken@example.com');
    fireEvent.press(screen.getByTestId('send-email-code'));
    expect(await screen.findByText(/already exists/)).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('register-sign-in-instead'));
    expect(await screen.findByTestId('signin-user-id')).toBeOnTheScreen();
  });

  it('rejects a mobile number linked to another account', async () => {
    await registerDirect(server, { userType: 'individual', email: 'first@example.com', mobile: '+919800000002' });
    await startRegistration();
    await verifyEmail('second@example.com');
    fireEvent.changeText(screen.getByTestId('register-mobile'), '98000 00002');
    fireEvent.press(screen.getByTestId('send-phone-code'));
    expect(await screen.findByText(/already linked to an account/)).toBeOnTheScreen();
  });

  it('requires a first name, a strong password and a matching confirmation', async () => {
    await startRegistration();
    await verifyEmail('new@example.com');
    await verifyPhone('98123 45678');
    fireEvent.press(screen.getByTestId('register-name-next'));
    expect(await screen.findByText('First name is required.')).toBeOnTheScreen();
    await enterName('Asha', '');

    submitPassword('short');
    expect(await screen.findByText('Password must be at least 8 characters.')).toBeOnTheScreen();
    submitPassword('allletters');
    expect(await screen.findByText('Use at least one letter and one number.')).toBeOnTheScreen();
    submitPassword('Secret123', 'Secret124');
    expect(await screen.findByText('Passwords do not match.')).toBeOnTheScreen();
    expect(callsTo('auth/register/complete')).toHaveLength(0);
  });

  it('shows a friendly error when offline and never leaks server details', async () => {
    await startRegistration();
    server.state.failNext = 'network';
    fireEvent.changeText(screen.getByTestId('register-email'), 'new@example.com');
    fireEvent.press(screen.getByTestId('send-email-code'));
    expect(await screen.findByText(/appear to be offline/)).toBeOnTheScreen();

    server.state.failNext = { status: 500, body: { status: false, message: 'SQLSTATE[HY000] secret' } };
    fireEvent.press(screen.getByTestId('send-email-code'));
    expect(await screen.findByText(/Something went wrong on our side/)).toBeOnTheScreen();
    expect(screen.queryByText(/SQLSTATE/)).toBeNull();
  });
});

describe('corporate sign-up', () => {
  it('rejects a work email from an unregistered organisation', async () => {
    await startRegistration('corporate');
    fireEvent.changeText(screen.getByTestId('register-email'), 'someone@unknown-co.com');
    fireEvent.press(screen.getByTestId('send-email-code'));
    expect(await screen.findByText(/organisation is not registered/)).toBeOnTheScreen();
  });

  it('creates a corporate account linked to the organisation, with an optional employee ID', async () => {
    await startRegistration('corporate');
    await verifyEmail('ravi@fixturecorp.com');
    await verifyPhone('9876500000');
    await enterName('Ravi', 'Kumar', 'FC-1042');
    expect(screen.getByTestId('register-user-id')).toHaveTextContent(/employee ID \(FC-1042\)/);
    submitPassword('Secret123');
    expect(await screen.findByText('Covered by Fixture Corp')).toBeOnTheScreen();

    const row = server.state.employee_list.find((r) => r.emp_email === 'ravi@fixturecorp.com')!;
    expect(row).toMatchObject({ emp_role: 'corporate', emp_companyname: 'Fixture Corp', emp_companyid: 'FC-1042' });
  });

  it('lets a corporate user sign in with their employee ID', async () => {
    await registerDirect(server, { email: 'ravi@fixturecorp.com', mobile: '+919876500000', firstName: 'Ravi', employeeId: 'FC-1042' });
    await openSignIn();
    signIn('FC-1042', TEST_PASSWORD);
    expect(await screen.findByText('Hi, Ravi 👋')).toBeOnTheScreen();
  });
});

describe('sign in with user ID + password', () => {
  beforeEach(async () => {
    await registerDirect(server, { userType: 'individual', email: 'meera@example.com', mobile: '+919811122233', firstName: 'Meera' });
  });

  it('signs in with email', async () => {
    await openSignIn();
    signIn('Meera@Example.com', TEST_PASSWORD);
    expect(await screen.findByText('Hi, Meera 👋')).toBeOnTheScreen();
    expect((await sessionStore.load())?.user.email).toBe('meera@example.com');
  });

  it('signs in with the mobile number in local format', async () => {
    await openSignIn();
    signIn('98111 22233', TEST_PASSWORD);
    expect(await screen.findByText('Hi, Meera 👋')).toBeOnTheScreen();
  });

  it('gives the same message for a wrong password and an unknown user', async () => {
    await openSignIn();
    signIn('meera@example.com', 'WrongPass1');
    expect(await screen.findByText('Incorrect user ID or password.')).toBeOnTheScreen();
    signIn('nobody@example.com', TEST_PASSWORD);
    expect(await screen.findByText('Incorrect user ID or password.')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('locks sign in after repeated failures, even with the right password', async () => {
    await openSignIn();
    for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) {
      signIn('meera@example.com', `Wrong${i}pass`);
      await screen.findByText('Incorrect user ID or password.');
    }
    signIn('meera@example.com', TEST_PASSWORD);
    expect(await screen.findByText(/Too many failed attempts/)).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('asks for both fields before calling the server', async () => {
    await openSignIn();
    fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText('Enter your user ID and password.')).toBeOnTheScreen();
    expect(callsTo('auth/login')).toHaveLength(0);
  });
});

describe('registration API rules (server side)', () => {
  it('refuses to complete sign-up before the mobile number is verified', async () => {
    const api = createEndpoints(
      createApiClient({
        baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL!,
        getAccessToken: async () => null,
        fetchImpl: server.fetch,
      }),
    );
    const otp = await api.auth.register.requestEmailOtp('skip@example.com', 'individual');
    const { registrationToken } = await api.auth.register.verifyEmailOtp(otp.requestId, '123456');
    await expect(
      api.auth.register.complete(registrationToken, { firstName: 'A', lastName: null, password: 'Secret123', employeeId: null }),
    ).rejects.toMatchObject({ code: 'VERIFICATION_REQUIRED' });
    expect(server.state.employee_list.find((r) => r.emp_email === 'skip@example.com')?.status).toBe('pending');
  });
});

describe('session lifecycle', () => {
  it('restores a persisted session on launch', async () => {
    await signInDirect(server);
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Hi, Harsha 👋')).toBeOnTheScreen();
  });

  it('discards an expired stored session', async () => {
    const session = await signInDirect(server);
    await sessionStore.save({ ...session, expiresAt: new Date(Date.now() - 1000).toISOString() });
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('get-started')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('signs out when the server rejects the session (401)', async () => {
    await signInDirect(server);
    server.state.sessions.clear(); // revoked server-side
    renderRouter(APP_DIR, { initialUrl: '/profile' });
    expect(await screen.findByTestId('session-expired')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('logs out, revoking the server session and clearing the device', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await signInDirect(server);
    renderRouter(APP_DIR, { initialUrl: '/profile' });
    fireEvent.press(await screen.findByTestId('logout'));
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => {
      await buttons.find((b) => b.text === 'Log out')!.onPress!();
    });
    expect(await screen.findByTestId('get-started')).toBeOnTheScreen();
    expect(callsTo('auth/logout')).toHaveLength(1);
    await waitFor(() => expect(server.state.sessions.size).toBe(0));
    expect(await sessionStore.load()).toBeNull();
  });
});
