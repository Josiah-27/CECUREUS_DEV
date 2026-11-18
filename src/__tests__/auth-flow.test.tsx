import { act, cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert, Linking } from 'react-native';

import { sessionStore } from '@/auth/session-store';
import { APP_DIR, installMockServer, resetDeviceStorage, signInDirect } from '@/test/harness';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_MS, OTP_TTL_MS, type MockServer } from '@/test/mock-server';

let server: MockServer;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-25T06:00:00.000Z') });
  resetDeviceStorage();
  server = installMockServer();
});

// Unmount while the fake clock is still installed, so nothing from this test is left waiting on it.
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

const callsTo = (path: string) => server.state.calls.filter((c) => c.path === path);

/** The CecureUs team has added this person to employee_list. */
function addPerson(fields: Parameters<MockServer['addEmployee']>[0] = {}) {
  return server.addEmployee({
    emp_name: 'Test',
    emp_lname: 'User',
    emp_email: 'employee.one@fixturecorp.com',
    emp_mobile: '9876543210',
    emp_option: 'Corporate',
    emp_companyname: 'Fixture Corp',
    ...fields,
  });
}

async function openSignIn() {
  await renderRouter(APP_DIR, { initialUrl: '/' });
  await fireEvent.press(await screen.findByTestId('have-account'));
  await screen.findByTestId('signin-mobile');
}

async function requestCode(mobile: string) {
  await fireEvent.changeText(screen.getByTestId('signin-mobile'), mobile);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  return screen.findByTestId('otp-input');
}

async function startRegistration(type: 'individual' | 'corporate' = 'individual') {
  await renderRouter(APP_DIR, { initialUrl: '/' });
  await fireEvent.press(await screen.findByTestId('get-started'));
  await fireEvent.press(await screen.findByTestId(`choose-${type}`));
  await screen.findByTestId('register-first-name');
}

async function fillDetails(d: { first?: string; last?: string; mobile?: string; email?: string; company?: string; employeeId?: string }) {
  if (d.first !== undefined) await fireEvent.changeText(screen.getByTestId('register-first-name'), d.first);
  if (d.last !== undefined) await fireEvent.changeText(screen.getByTestId('register-last-name'), d.last);
  if (d.mobile !== undefined) await fireEvent.changeText(screen.getByTestId('register-mobile'), d.mobile);
  if (d.email !== undefined) await fireEvent.changeText(screen.getByTestId('register-email'), d.email);
  if (d.company !== undefined) await fireEvent.changeText(screen.getByTestId('register-company'), d.company);
  if (d.employeeId !== undefined) await fireEvent.changeText(screen.getByTestId('register-employee-id'), d.employeeId);
}

describe('entry points', () => {
  it('Get Started asks corporate or individual; "I already have an account" asks for a mobile number', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Your Mental Health Matters')).toBeOnTheScreen();
    expect(screen.getByTestId('emergency-banner')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('get-started'));
    expect(await screen.findByText('I am a Corporate Employee')).toBeOnTheScreen();
    expect(screen.getByText('I am an Individual')).toBeOnTheScreen();
  });

  it('opens sign in from the splash and can switch to account creation', async () => {
    await openSignIn();
    expect(screen.getByText('Welcome back')).toBeOnTheScreen();
    expect(screen.queryByText(/password/i)).toBeNull();
    await fireEvent.press(screen.getByTestId('go-register'));
    expect(await screen.findByText('I am an Individual')).toBeOnTheScreen();
  });
});

describe('sign up: details → SMS code → account created, team told on WhatsApp', () => {
  it('creates an individual account, signs in and opens WhatsApp with the details', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await startRegistration('individual');
    expect(screen.getByTestId('register-step')).toHaveTextContent(/Step 1 of 2/);
    expect(screen.queryByTestId('register-company')).toBeNull();

    await fillDetails({ first: 'New', last: 'Person', mobile: '98123 45678', email: 'New.Person@Example.com' });
    await fireEvent.press(screen.getByTestId('register-send'));

    const input = await screen.findByTestId('otp-input');
    expect(screen.getByTestId('register-step')).toHaveTextContent(/Step 2 of 2/);
    expect(server.state.smsLog).toEqual([expect.objectContaining({ to: '+919812345678' })]);
    // Nobody can sign in with the number, and the team hears nothing, until the code is verified.
    expect(server.state.employee_list.filter((r) => r.status === 'Active')).toHaveLength(0);
    expect(open).not.toHaveBeenCalled();

    await fireEvent.changeText(input, '123456');
    expect(await screen.findByText('Hi, New 👋')).toBeOnTheScreen();

    expect(server.state.employee_list).toEqual([
      expect.objectContaining({
        emp_name: 'New',
        emp_lname: 'Person',
        emp_mobile: '9812345678',
        emp_email: 'new.person@example.com',
        emp_option: 'Individual',
        status: 'Active',
      }),
    ]);
    expect((await sessionStore.load())?.user.firstName).toBe('New');

    await waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    const url = open.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/wa\.me\/917200500221\?text=/);
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('Account type: Individual');
    expect(text).toContain('Name: New Person');
    expect(text).toContain('Mobile: +91 98123 45678');
    expect(text).toContain('Email: new.person@example.com');
    expect(text).not.toContain('Company');
  });

  it('stores the company and tells the team the employee ID for corporate employees', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await startRegistration('corporate');
    await fillDetails({ first: 'Arun', mobile: '9876543210', email: 'arun@fixturecorp.com', company: 'Fixture Corp', employeeId: 'FC-102' });
    await fireEvent.press(screen.getByTestId('register-send'));
    await fireEvent.changeText(await screen.findByTestId('otp-input'), '123456');
    expect(await screen.findByText('Hi, Arun 👋')).toBeOnTheScreen();
    expect(server.state.employee_list[0]).toEqual(
      expect.objectContaining({ emp_option: 'Corporate', emp_companyname: 'Fixture Corp', status: 'Active' }),
    );
    await waitFor(() => expect(open).toHaveBeenCalled());
    const text = decodeURIComponent(open.mock.calls[0][0].split('?text=')[1]);
    expect(text).toContain('Account type: Corporate employee');
    expect(text).toContain('Company: Fixture Corp');
    expect(text).toContain('Employee ID: FC-102');
  });

  it('validates every field before calling the server', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await startRegistration('corporate');
    await fillDetails({ mobile: '12345', email: 'not-an-email' });
    await fireEvent.press(screen.getByTestId('register-send'));
    expect(await screen.findByText('First name is required.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a valid 10-digit Indian mobile number.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(screen.getByText('Company name is required.')).toBeOnTheScreen();
    expect(server.state.calls).toHaveLength(0);
    expect(open).not.toHaveBeenCalled();
  });

  it('does not create an account when the code is wrong', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await startRegistration('individual');
    await fillDetails({ first: 'New', mobile: '9812345678', email: 'new.person@example.com' });
    await fireEvent.press(screen.getByTestId('register-send'));
    await fireEvent.changeText(await screen.findByTestId('otp-input'), '000000');
    expect(await screen.findByTestId('otp-error')).toHaveTextContent('Incorrect code. Please try again.');
    expect(server.state.employee_list.filter((r) => r.status === 'Active')).toHaveLength(0);
    expect(await sessionStore.load()).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('still signs the person in when WhatsApp cannot be opened', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await startRegistration('individual');
    await fillDetails({ first: 'New', mobile: '9812345678', email: 'new.person@example.com' });
    await fireEvent.press(screen.getByTestId('register-send'));
    await fireEvent.changeText(await screen.findByTestId('otp-input'), '123456');
    expect(await screen.findByText('Hi, New 👋')).toBeOnTheScreen();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Unable to open WhatsApp', expect.stringMatching(/72005 00221/)));
  });

  it('sends a number that already has an account to sign in instead', async () => {
    addPerson();
    await startRegistration('individual');
    await fillDetails({ first: 'Test', mobile: '9876543210', email: 'test.user@example.com' });
    await fireEvent.press(screen.getByTestId('register-send'));
    expect(await screen.findByTestId('register-error')).toHaveTextContent(/already has a CecureUs account/);
    expect(server.state.smsLog).toHaveLength(0);
    expect(server.state.employee_list).toHaveLength(1);
    await fireEvent.press(screen.getByTestId('register-go-sign-in'));
    expect(await screen.findByTestId('signin-mobile')).toBeOnTheScreen();
  });

  it('does not let a deactivated number sign up again', async () => {
    addPerson({ status: 'DeActive' });
    await startRegistration('individual');
    await fillDetails({ first: 'Test', mobile: '9876543210', email: 'test.user@example.com' });
    await fireEvent.press(screen.getByTestId('register-send'));
    expect(await screen.findByTestId('register-error')).toHaveTextContent(/Your account is not active/);
    expect(server.state.smsLog).toHaveLength(0);
  });
});

describe('sign in with mobile number + SMS code', () => {
  it('signs in a registered, active employee', async () => {
    addPerson();
    await openSignIn();
    await fireEvent.changeText(await requestCode('98765 43210'), '123456');
    expect(await screen.findByText('Hi, Test 👋')).toBeOnTheScreen();
    expect(server.state.smsLog).toEqual([expect.objectContaining({ to: '+919876543210' })]);
    expect((await sessionStore.load())?.user.userType).toBe('corporate');
  });

  it('accepts numbers stored with a country code or leading zero', async () => {
    addPerson({ emp_mobile: '91-9876543210' });
    await openSignIn();
    await fireEvent.changeText(await requestCode('+91 98765 43210'), '123456');
    expect(await screen.findByText('Hi, Test 👋')).toBeOnTheScreen();
  });

  it('validates the number before calling the server', async () => {
    await openSignIn();
    await fireEvent.changeText(screen.getByTestId('signin-mobile'), '12345');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText('Enter a valid 10-digit Indian mobile number.')).toBeOnTheScreen();
    expect(server.state.calls).toHaveLength(0);
  });

  it('tells an unregistered number to create an account (and sends no SMS)', async () => {
    await openSignIn();
    await fireEvent.changeText(screen.getByTestId('signin-mobile'), '9000000001');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText('This number is not registered with CecureUs yet.')).toBeOnTheScreen();
    expect(screen.getByText(/Create an account to get started/)).toBeOnTheScreen();
    expect(server.state.smsLog).toHaveLength(0);
  });

  it('refuses accounts the team has deactivated', async () => {
    addPerson({ status: 'DeActive' });
    await openSignIn();
    await fireEvent.changeText(screen.getByTestId('signin-mobile'), '9876543210');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText(/Your account is not active/)).toBeOnTheScreen();
    expect(server.state.smsLog).toHaveLength(0);
  });

  it('rejects a wrong code', async () => {
    addPerson();
    await openSignIn();
    await fireEvent.changeText(await requestCode('9876543210'), '000000');
    expect(await screen.findByText('Incorrect code. Please try again.')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('rejects an expired code (expiry enforced by the server)', async () => {
    addPerson();
    await openSignIn();
    const input = await requestCode('9876543210');
    server.state.otps.forEach((o) => (o.issuedAt -= OTP_TTL_MS + 1000));
    await fireEvent.changeText(input, '123456');
    expect(await screen.findByText('This code has expired. Please request a new one.')).toBeOnTheScreen();
  });

  it('disables verification once the code expires on the client', async () => {
    addPerson();
    await openSignIn();
    await requestCode('9876543210');
    await act(() => {
      jest.advanceTimersByTime(OTP_TTL_MS + 1000);
    });
    expect(await screen.findByText('This code has expired. Request a new one.')).toBeOnTheScreen();
    expect(screen.getByTestId('verify-code')).toBeDisabled();
  });

  it('enforces the resend cooldown, then sends a new code', async () => {
    addPerson();
    await openSignIn();
    await requestCode('9876543210');
    expect(screen.getByTestId('resend-code')).toBeDisabled();
    await act(() => {
      jest.advanceTimersByTime(OTP_RESEND_MS + 1000);
    });
    expect(await screen.findByText('Resend code')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('resend-code'));
    expect(await screen.findByText('A new code has been sent.')).toBeOnTheScreen();
    expect(callsTo('auth/otp/request')).toHaveLength(2);
  });

  it('locks a code after repeated wrong attempts', async () => {
    addPerson();
    await openSignIn();
    const input = await requestCode('9876543210');
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      await fireEvent.changeText(input, '000000');
      await screen.findByText('Incorrect code. Please try again.');
    }
    await fireEvent.changeText(input, '123456');
    expect(await screen.findByText(/Too many attempts/)).toBeOnTheScreen();
  });

  it('can go back and use a different number', async () => {
    addPerson();
    await openSignIn();
    await requestCode('9876543210');
    await fireEvent.press(screen.getByTestId('change-destination'));
    expect(await screen.findByTestId('signin-mobile')).toBeOnTheScreen();
  });

  it('shows a friendly error when offline and never leaks server details', async () => {
    await openSignIn();
    server.state.failNext = 'network';
    await fireEvent.changeText(screen.getByTestId('signin-mobile'), '9876543210');
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText(/appear to be offline/)).toBeOnTheScreen();

    server.state.failNext = { status: 500, body: { status: false, message: 'SQLSTATE[HY000] secret' } };
    await fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText(/Something went wrong on our side/)).toBeOnTheScreen();
    expect(screen.queryByText(/SQLSTATE/)).toBeNull();
  });
});

describe('session lifecycle', () => {
  it('restores a persisted session on launch', async () => {
    await signInDirect(server);
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Hi, Test 👋')).toBeOnTheScreen();
  });

  it('discards an expired stored session', async () => {
    const session = await signInDirect(server);
    await sessionStore.save({ ...session, expiresAt: new Date(Date.now() - 1000).toISOString() });
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('get-started')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('signs out when the server rejects the session (401)', async () => {
    await signInDirect(server);
    server.state.sessions.clear(); // revoked server-side
    await renderRouter(APP_DIR, { initialUrl: '/profile' });
    expect(await screen.findByTestId('session-expired')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('logs out, revoking the server session and clearing the device', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await signInDirect(server);
    await renderRouter(APP_DIR, { initialUrl: '/profile' });
    await fireEvent.press(await screen.findByTestId('logout'));
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
