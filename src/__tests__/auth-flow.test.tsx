import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
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

afterEach(() => {
  jest.useRealTimers();
});

const callsTo = (path: string) => server.state.calls.filter((c) => c.path === path);

/** The CecureUs team has added this person to employee_list. */
function addPerson(fields: Parameters<MockServer['addEmployee']>[0] = {}) {
  return server.addEmployee({
    emp_name: 'Harsha',
    emp_lname: 'Verma',
    emp_email: 'harsha@fixturecorp.com',
    emp_mobile: '9876543210',
    emp_option: 'Corporate',
    emp_companyname: 'Fixture Corp',
    ...fields,
  });
}

async function openSignIn() {
  renderRouter(APP_DIR, { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('have-account'));
  await screen.findByTestId('signin-mobile');
}

async function requestCode(mobile: string) {
  fireEvent.changeText(screen.getByTestId('signin-mobile'), mobile);
  fireEvent.press(screen.getByTestId('signin-submit'));
  return screen.findByTestId('otp-input');
}

async function startRegistration(type: 'individual' | 'corporate' = 'individual') {
  renderRouter(APP_DIR, { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
  fireEvent.press(await screen.findByTestId(`choose-${type}`));
  await screen.findByTestId('register-first-name');
}

function fillDetails(d: { first?: string; last?: string; mobile?: string; email?: string; company?: string; employeeId?: string }) {
  if (d.first !== undefined) fireEvent.changeText(screen.getByTestId('register-first-name'), d.first);
  if (d.last !== undefined) fireEvent.changeText(screen.getByTestId('register-last-name'), d.last);
  if (d.mobile !== undefined) fireEvent.changeText(screen.getByTestId('register-mobile'), d.mobile);
  if (d.email !== undefined) fireEvent.changeText(screen.getByTestId('register-email'), d.email);
  if (d.company !== undefined) fireEvent.changeText(screen.getByTestId('register-company'), d.company);
  if (d.employeeId !== undefined) fireEvent.changeText(screen.getByTestId('register-employee-id'), d.employeeId);
}

describe('entry points', () => {
  it('Get Started asks corporate or individual; "I already have an account" asks for a mobile number', async () => {
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
    expect(screen.queryByText(/password/i)).toBeNull();
    fireEvent.press(screen.getByTestId('go-register'));
    expect(await screen.findByText('I am an Individual')).toBeOnTheScreen();
  });
});

describe('sign-up request via WhatsApp', () => {
  it('sends the individual details to the CecureUs WhatsApp number and writes nothing to the backend', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await startRegistration('individual');
    expect(screen.getByTestId('register-step')).toHaveTextContent(/Step 1 of 2/);
    expect(screen.queryByTestId('register-company')).toBeNull();

    fillDetails({ first: 'Priya', last: 'Nair', mobile: '98123 45678', email: 'Priya@Example.com' });
    fireEvent.press(screen.getByTestId('register-send'));

    expect(await screen.findByTestId('register-sent')).toBeOnTheScreen();
    expect(screen.getByTestId('register-step')).toHaveTextContent(/Step 2 of 2/);
    expect(screen.getByText(/sign in with \+91 98123 45678/)).toBeOnTheScreen();

    const url = open.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/wa\.me\/917200500221\?text=/);
    const text = decodeURIComponent(url.split('?text=')[1]);
    expect(text).toContain('Account type: Individual');
    expect(text).toContain('Name: Priya Nair');
    expect(text).toContain('Mobile: +91 98123 45678');
    expect(text).toContain('Email: priya@example.com');
    expect(text).not.toContain('Company');

    expect(server.state.calls).toHaveLength(0);
    expect(server.state.employee_list).toHaveLength(0);
  });

  it('includes company and employee ID for corporate employees', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await startRegistration('corporate');
    fillDetails({ first: 'Arun', mobile: '9876543210', email: 'arun@fixturecorp.com', company: 'Fixture Corp', employeeId: 'FC-102' });
    fireEvent.press(screen.getByTestId('register-send'));
    await screen.findByTestId('register-sent');
    const text = decodeURIComponent(open.mock.calls[0][0].split('?text=')[1]);
    expect(text).toContain('Account type: Corporate employee');
    expect(text).toContain('Company: Fixture Corp');
    expect(text).toContain('Employee ID: FC-102');
  });

  it('validates every field before opening WhatsApp', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await startRegistration('corporate');
    fillDetails({ mobile: '12345', email: 'not-an-email' });
    fireEvent.press(screen.getByTestId('register-send'));
    expect(await screen.findByText('First name is required.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a valid 10-digit Indian mobile number.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(screen.getByText('Company name is required.')).toBeOnTheScreen();
    expect(open).not.toHaveBeenCalled();
  });

  it('stays on the form when WhatsApp cannot be opened, and explains how to reach the team', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await startRegistration('individual');
    fillDetails({ first: 'Priya', mobile: '9812345678', email: 'priya@example.com' });
    fireEvent.press(screen.getByTestId('register-send'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Unable to open WhatsApp', expect.stringMatching(/72005 00221/)));
    expect(screen.queryByTestId('register-sent')).toBeNull();
  });

  it('leads to sign in once the request is sent', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await startRegistration('individual');
    fillDetails({ first: 'Priya', mobile: '9812345678', email: 'priya@example.com' });
    fireEvent.press(screen.getByTestId('register-send'));
    fireEvent.press(await screen.findByTestId('register-go-sign-in'));
    expect(await screen.findByTestId('signin-mobile')).toBeOnTheScreen();
  });
});

describe('sign in with mobile number + SMS code', () => {
  it('signs in a registered, active employee', async () => {
    addPerson();
    await openSignIn();
    fireEvent.changeText(await requestCode('98765 43210'), '123456');
    expect(await screen.findByText('Hi, Harsha 👋')).toBeOnTheScreen();
    expect(server.state.smsLog).toEqual([expect.objectContaining({ to: '+919876543210' })]);
    expect((await sessionStore.load())?.user.userType).toBe('corporate');
  });

  it('accepts numbers stored with a country code or leading zero', async () => {
    addPerson({ emp_mobile: '91-9876543210' });
    await openSignIn();
    fireEvent.changeText(await requestCode('+91 98765 43210'), '123456');
    expect(await screen.findByText('Hi, Harsha 👋')).toBeOnTheScreen();
  });

  it('validates the number before calling the server', async () => {
    await openSignIn();
    fireEvent.changeText(screen.getByTestId('signin-mobile'), '12345');
    fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText('Enter a valid 10-digit Indian mobile number.')).toBeOnTheScreen();
    expect(server.state.calls).toHaveLength(0);
  });

  it('tells an unregistered number to send a sign-up request (and sends no SMS)', async () => {
    await openSignIn();
    fireEvent.changeText(screen.getByTestId('signin-mobile'), '9000000001');
    fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText('This number is not registered with CecureUs yet.')).toBeOnTheScreen();
    expect(screen.getByText(/Send us your details/)).toBeOnTheScreen();
    expect(server.state.smsLog).toHaveLength(0);
  });

  it('refuses accounts the team has deactivated', async () => {
    addPerson({ status: 'DeActive' });
    await openSignIn();
    fireEvent.changeText(screen.getByTestId('signin-mobile'), '9876543210');
    fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText(/Your account is not active/)).toBeOnTheScreen();
    expect(server.state.smsLog).toHaveLength(0);
  });

  it('rejects a wrong code', async () => {
    addPerson();
    await openSignIn();
    fireEvent.changeText(await requestCode('9876543210'), '000000');
    expect(await screen.findByText('Incorrect code. Please try again.')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('rejects an expired code (expiry enforced by the server)', async () => {
    addPerson();
    await openSignIn();
    const input = await requestCode('9876543210');
    server.state.otps.forEach((o) => (o.issuedAt -= OTP_TTL_MS + 1000));
    fireEvent.changeText(input, '123456');
    expect(await screen.findByText('This code has expired. Please request a new one.')).toBeOnTheScreen();
  });

  it('disables verification once the code expires on the client', async () => {
    addPerson();
    await openSignIn();
    await requestCode('9876543210');
    act(() => {
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
    act(() => {
      jest.advanceTimersByTime(OTP_RESEND_MS + 1000);
    });
    expect(await screen.findByText('Resend code')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('resend-code'));
    expect(await screen.findByText('A new code has been sent.')).toBeOnTheScreen();
    expect(callsTo('auth/otp/request')).toHaveLength(2);
  });

  it('locks a code after repeated wrong attempts', async () => {
    addPerson();
    await openSignIn();
    const input = await requestCode('9876543210');
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      fireEvent.changeText(input, '000000');
      await screen.findByText('Incorrect code. Please try again.');
    }
    fireEvent.changeText(input, '123456');
    expect(await screen.findByText(/Too many attempts/)).toBeOnTheScreen();
  });

  it('can go back and use a different number', async () => {
    addPerson();
    await openSignIn();
    await requestCode('9876543210');
    fireEvent.press(screen.getByTestId('change-destination'));
    expect(await screen.findByTestId('signin-mobile')).toBeOnTheScreen();
  });

  it('shows a friendly error when offline and never leaks server details', async () => {
    await openSignIn();
    server.state.failNext = 'network';
    fireEvent.changeText(screen.getByTestId('signin-mobile'), '9876543210');
    fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText(/appear to be offline/)).toBeOnTheScreen();

    server.state.failNext = { status: 500, body: { status: false, message: 'SQLSTATE[HY000] secret' } };
    fireEvent.press(screen.getByTestId('signin-submit'));
    expect(await screen.findByText(/Something went wrong on our side/)).toBeOnTheScreen();
    expect(screen.queryByText(/SQLSTATE/)).toBeNull();
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
