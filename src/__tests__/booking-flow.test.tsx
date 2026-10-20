import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { APP_DIR, installMockServer, resetDeviceStorage, signInDirect } from '@/test/harness';
import { ADMIN_SMS_NUMBER, type MockServer } from '@/test/mock-server';

const SLOT = '2026-11-02T04:30:00.000Z';
const SLOT_DAY = '2026-11-02';
let server: MockServer;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-25T06:00:00.000Z') });
  resetDeviceStorage();
  server = installMockServer();
  await signInDirect(server, 'corporate');
});

afterEach(() => jest.useRealTimers());

const bookingPosts = () => server.state.calls.filter((c) => c.method === 'POST' && c.path === 'bookings');

async function selectSlotAndMode(mode: 'audio' | 'video' | 'chat' = 'video') {
  renderRouter(APP_DIR, { initialUrl: '/book/1' });
  fireEvent.press(await screen.findByTestId(`day-${SLOT_DAY}`));
  fireEvent.press(await screen.findByTestId(`slot-${SLOT}`));
  fireEvent.press(screen.getByTestId(`mode-${mode}`));
}

describe('booking workflow', () => {
  it('keeps Confirm disabled until a slot and mode are chosen', async () => {
    renderRouter(APP_DIR, { initialUrl: '/book/1' });
    expect(await screen.findByTestId('confirm-booking')).toBeDisabled();
    fireEvent.press(await screen.findByTestId(`slot-${SLOT}`));
    expect(screen.getByTestId('confirm-booking')).toBeDisabled();
    fireEvent.press(screen.getByTestId('mode-audio'));
    expect(screen.getByTestId('confirm-booking')).toBeEnabled();
  });

  it('books a session, shows confirmation only after the server confirms, and triggers exactly one SMS', async () => {
    await selectSlotAndMode('video');
    expect(screen.getByTestId('covered-notice')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('confirm-booking'));

    expect(await screen.findByText('Booking Confirmed!')).toBeOnTheScreen();
    expect(screen.getByText('Test Counsellor One')).toBeOnTheScreen();

    const [post] = bookingPosts();
    expect(post.body).toMatchObject({ counsellorId: '1', slotStart: SLOT, mode: 'video' });
    expect(post.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(server.state.bookings).toHaveLength(1);
    expect(server.state.smsLog).toEqual([{ to: ADMIN_SMS_NUMBER, message: expect.stringContaining(SLOT) }]);
  });

  it('handles a slot taken by someone else: no booking, clear message, availability refreshed', async () => {
    await selectSlotAndMode();
    const availabilityCalls = () => server.state.calls.filter((c) => c.path.endsWith('/availability')).length;
    const before = availabilityCalls();
    server.state.openSlots.delete(SLOT); // another user books it first
    fireEvent.press(screen.getByTestId('confirm-booking'));

    expect(await screen.findByText(/just booked by someone else/)).toBeOnTheScreen();
    expect(screen.queryByText('Booking Confirmed!')).toBeNull();
    expect(server.state.bookings).toHaveLength(0);
    expect(server.state.smsLog).toHaveLength(0);
    await waitFor(() => expect(availabilityCalls()).toBe(before + 1));
    await waitFor(() => expect(screen.queryByTestId(`slot-${SLOT}`)).toBeNull());
  });

  it('retries after a lost response with the same Idempotency-Key — one booking, one SMS', async () => {
    const realFetch = server.fetch;
    let dropped = false;
    globalThis.fetch = (async (input, init) => {
      const res = await realFetch(input, init);
      if (!dropped && init?.method === 'POST' && String(input).endsWith('/bookings')) {
        dropped = true; // server processed it, but the response never arrived
        throw new TypeError('Network request failed');
      }
      return res;
    }) as typeof fetch;

    await selectSlotAndMode();
    fireEvent.press(screen.getByTestId('confirm-booking'));
    expect(await screen.findByText(/Your booking was not confirmed/)).toBeOnTheScreen();
    expect(screen.queryByText('Booking Confirmed!')).toBeNull();

    fireEvent.press(screen.getByTestId('confirm-booking'));
    expect(await screen.findByText('Booking Confirmed!')).toBeOnTheScreen();

    const posts = bookingPosts();
    expect(posts).toHaveLength(2);
    expect(posts[0].headers['Idempotency-Key']).toBe(posts[1].headers['Idempotency-Key']);
    expect(server.state.bookings).toHaveLength(1);
    expect(server.state.smsLog).toHaveLength(1);
  });

  it('ignores a double tap on Confirm', async () => {
    await selectSlotAndMode();
    const button = screen.getByTestId('confirm-booking');
    fireEvent.press(button);
    fireEvent.press(button);
    expect(await screen.findByText('Booking Confirmed!')).toBeOnTheScreen();
    expect(bookingPosts()).toHaveLength(1);
  });

  it('never shows a pending booking as confirmed', async () => {
    await selectSlotAndMode();
    server.state.failNext = {
      status: 201,
      body: {
        status: true,
        data: {
          id: 'bk-p', counsellorId: '1', counsellorName: 'Test Counsellor One', start: SLOT,
          end: '2026-11-02T05:30:00.000Z', mode: 'video', status: 'pending',
        },
      },
    };
    fireEvent.press(screen.getByTestId('confirm-booking'));
    expect(await screen.findByText('Booking Request Received')).toBeOnTheScreen();
    expect(screen.queryByText('Booking Confirmed!')).toBeNull();
  });

  it('shows an error (not a confirmation) when the server fails', async () => {
    await selectSlotAndMode();
    server.state.failNext = { status: 500, body: { status: false, message: 'boom' } };
    fireEvent.press(screen.getByTestId('confirm-booking'));
    expect(await screen.findByTestId('booking-error')).toHaveTextContent(/Something went wrong/);
    expect(screen.queryByText('Booking Confirmed!')).toBeNull();
  });

  it('shows an empty state when the counsellor has no availability', async () => {
    server.state.openSlots.clear();
    renderRouter(APP_DIR, { initialUrl: '/book/1' });
    expect(await screen.findByText('No available slots')).toBeOnTheScreen();
    expect(screen.getByTestId('confirm-booking')).toBeDisabled();
  });

  it('hides slots that have already started (stale availability)', async () => {
    jest.setSystemTime(new Date('2026-11-02T05:00:00.000Z')); // after 04:30Z slot starts
    renderRouter(APP_DIR, { initialUrl: '/book/1' });
    await screen.findByTestId('confirm-booking');
    await waitFor(() => expect(screen.queryByTestId('slot-2026-11-02T05:30:00.000Z')).toBeOnTheScreen());
    expect(screen.queryByTestId(`slot-${SLOT}`)).toBeNull();
  });

  it('only offers the session modes the counsellor supports', async () => {
    renderRouter(APP_DIR, { initialUrl: '/book/2' });
    expect(await screen.findByTestId('mode-audio')).toBeOnTheScreen();
    expect(screen.getByTestId('mode-video')).toBeOnTheScreen();
    expect(screen.queryByTestId('mode-chat')).toBeNull();
  });

  it('does not show the corporate coverage notice to individual users', async () => {
    resetDeviceStorage();
    await signInDirect(server, 'individual', 'solo@example.com');
    renderRouter(APP_DIR, { initialUrl: '/book/1' });
    await screen.findByTestId('confirm-booking');
    expect(screen.queryByTestId('covered-notice')).toBeNull();
  });
});

describe('booking history and cancellation', () => {
  it('lists the booking under Upcoming and cancels it with a reason', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await selectSlotAndMode();
    fireEvent.press(screen.getByTestId('confirm-booking'));
    fireEvent.press(await screen.findByTestId('go-to-sessions'));

    const id = server.state.bookings[0].id;
    expect(await screen.findByTestId(`booking-${id}`)).toBeOnTheScreen();
    expect(screen.getByText('Confirmed')).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId(`cancel-${id}`));
    expect(screen.getByTestId('confirm-cancel')).toBeDisabled();
    fireEvent.press(screen.getByText('Schedule conflict'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-cancel'));
    });

    await waitFor(() => expect(server.state.bookings[0].status).toBe('cancelled'));
    const cancel = server.state.calls.find((c) => c.path === `bookings/${id}/cancel`);
    expect(cancel?.body).toEqual({ reason: 'Schedule conflict' });
    expect(server.state.openSlots.has(SLOT)).toBe(true);
    expect(alert).toHaveBeenCalledWith('Session cancelled', expect.any(String));
  });
});
