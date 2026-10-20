import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { sessionStore } from '@/auth/session-store';
import { APP_DIR, installMockServer, resetDeviceStorage, signInDirect } from '@/test/harness';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_MS, OTP_TTL_MS, type MockServer } from '@/test/mock-server';

let server: MockServer;

beforeEach(() => {
  resetDeviceStorage();
  server = installMockServer();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Splash → Get Started → user-type choice. */
async function openChooser() {
  renderRouter(APP_DIR, { initialUrl: '/' });
  fireEvent.press(await screen.findByTestId('get-started'));
}

async function goToVerify(email = 'harsha@fixturecorp.com') {
  await openChooser();
  fireEvent.press(await screen.findByTestId('choose-corporate'));
  fireEvent.changeText(await screen.findByTestId('email-input'), email);
  fireEvent.press(screen.getByTestId('send-code'));
  return screen.findByTestId('otp-input');
}

describe('email OTP authentication', () => {
  it('shows the welcome screen when signed out', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('get-started')).toBeOnTheScreen();
    expect(screen.getByText('Your Mental Health Matters')).toBeOnTheScreen();
    expect(screen.getByTestId('emergency-banner')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('have-account'));
    expect(await screen.findByText('I am a Corporate Employee')).toBeOnTheScreen();
    expect(screen.getByText('I am an Individual')).toBeOnTheScreen();
  });

  it('validates the email before calling the server', async () => {
    await openChooser();
    fireEvent.press(await screen.findByTestId('choose-individual'));
    fireEvent.changeText(await screen.findByTestId('email-input'), 'not-an-email');
    fireEvent.press(screen.getByTestId('send-code'));
    expect(await screen.findByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(server.state.calls).toHaveLength(0);
  });

  it('signs in with a valid OTP and persists the session', async () => {
    const input = await goToVerify();
    expect(server.state.calls[0]).toMatchObject({
      path: 'auth/otp/request',
      body: { email: 'harsha@fixturecorp.com', userType: 'corporate' },
    });
    fireEvent.changeText(input, '123456');
    expect(await screen.findByText('Hi, Harsha 👋')).toBeOnTheScreen();
    const stored = await sessionStore.load();
    expect(stored?.user.email).toBe('harsha@fixturecorp.com');
    expect(stored?.accessToken).toMatch(/^tok-/);
  });

  it('rejects an invalid OTP and stays signed out', async () => {
    const input = await goToVerify();
    fireEvent.changeText(input, '000000');
    expect(await screen.findByText('Incorrect code. Please try again.')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('rejects an expired OTP (expiry enforced by the server)', async () => {
    const input = await goToVerify();
    // Clock skew: the client countdown still shows time left, but the server says the code expired.
    server.state.otps.forEach((o) => (o.issuedAt -= OTP_TTL_MS + 1000));
    expect(screen.getByTestId('verify-code')).toBeOnTheScreen();
    fireEvent.changeText(input, '123456');
    expect(await screen.findByText('This code has expired. Please request a new one.')).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('disables verification once the code expires on the client', async () => {
    await goToVerify();
    act(() => {
      jest.advanceTimersByTime(OTP_TTL_MS + 1000);
    });
    expect(await screen.findByText('This code has expired. Request a new one.')).toBeOnTheScreen();
    expect(screen.getByTestId('verify-code')).toBeDisabled();
  });

  it('enforces the resend cooldown and issues a new code after it', async () => {
    await goToVerify();
    expect(screen.getByTestId('resend-code')).toBeDisabled();
    expect(screen.getByText(/Resend code in \d+s/)).toBeOnTheScreen();
    act(() => {
      jest.advanceTimersByTime(OTP_RESEND_MS + 1000);
    });
    expect(await screen.findByText('Resend code')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('resend-code'));
    expect(await screen.findByText('A new code has been sent to your email.')).toBeOnTheScreen();
    const requests = server.state.calls.filter((c) => c.path === 'auth/otp/request');
    expect(requests).toHaveLength(2);
    expect(screen.getByTestId('resend-code')).toBeDisabled();
  });

  it('locks out after repeated failed attempts', async () => {
    const input = await goToVerify();
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      fireEvent.changeText(input, '000000');
      await screen.findByText('Incorrect code. Please try again.');
    }
    fireEvent.changeText(input, '123456');
    expect(await screen.findByText(/Too many attempts/)).toBeOnTheScreen();
    expect(await sessionStore.load()).toBeNull();
  });

  it('shows a friendly error when the network fails', async () => {
    await openChooser();
    fireEvent.press(await screen.findByTestId('choose-individual'));
    fireEvent.changeText(await screen.findByTestId('email-input'), 'a@b.co');
    server.state.failNext = 'network';
    fireEvent.press(screen.getByTestId('send-code'));
    expect(await screen.findByText(/appear to be offline/)).toBeOnTheScreen();
  });

  it('shows a friendly error on server failure without leaking details', async () => {
    await openChooser();
    fireEvent.press(await screen.findByTestId('choose-individual'));
    fireEvent.changeText(await screen.findByTestId('email-input'), 'a@b.co');
    server.state.failNext = { status: 500, body: { status: false, message: 'SQLSTATE[HY000] secret' } };
    fireEvent.press(screen.getByTestId('send-code'));
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
    const { Alert } = jest.requireActual('react-native') as typeof import('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await signInDirect(server);
    renderRouter(APP_DIR, { initialUrl: '/profile' });
    fireEvent.press(await screen.findByTestId('logout'));
    const buttons = alert.mock.calls[0][2]!;
    await act(async () => {
      await buttons.find((b) => b.text === 'Log out')!.onPress!();
    });
    expect(await screen.findByTestId('get-started')).toBeOnTheScreen();
    expect(server.state.calls.some((c) => c.path === 'auth/logout')).toBe(true);
    expect(server.state.sessions.size).toBe(0);
    expect(await sessionStore.load()).toBeNull();
  });
});
