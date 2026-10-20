import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert, Linking } from 'react-native';

import { sessionStore } from '@/auth/session-store';
import { goalStore, journalStore, moodStore } from '@/local/stores';
import { APP_DIR, installMockServer, resetDeviceStorage, signInDirect } from '@/test/harness';
import type { MockServer } from '@/test/mock-server';

let server: MockServer;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-25T06:00:00.000Z') });
  resetDeviceStorage();
  server = installMockServer();
  await signInDirect(server, 'corporate');
});

afterEach(() => jest.useRealTimers());

describe('home', () => {
  it('greets the user, records mood locally and navigates via tiles', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Hi, Harsha 👋')).toBeOnTheScreen();
    expect(screen.getByText('Covered by Fixture Corp')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('mood-stressed'));
    expect(screen.getByTestId('mood-support')).toBeOnTheScreen();
    await waitFor(async () => expect((await moodStore.all())[0]?.mood).toBe('stressed'));
    expect(server.state.calls.some((c) => JSON.stringify(c.body ?? '').includes('stressed'))).toBe(false);

    fireEvent.press(screen.getByTestId('tile-breathing'));
    expect(await screen.findByTestId('exercise-box')).toBeOnTheScreen();
  });
});

describe('counsellor directory', () => {
  it('lists counsellors with de-duplicated expertise and searches server-side after debounce', async () => {
    renderRouter(APP_DIR, { initialUrl: '/counsellors' });
    expect(await screen.findByText('Test Counsellor One')).toBeOnTheScreen();
    expect(screen.getByText('Test Counsellor Two')).toBeOnTheScreen();
    expect(screen.getAllByText('Anxiety Management')).toHaveLength(1);

    fireEvent.changeText(screen.getByTestId('counsellor-search'), 'Mumbai');
    act(() => {
      jest.advanceTimersByTime(350);
    });
    await waitFor(() => expect(screen.queryByText('Test Counsellor One')).toBeNull());
    expect(screen.getByText('Test Counsellor Two')).toBeOnTheScreen();
    const searches = server.state.calls.filter((c) => c.path === 'counsellors' && c.url.includes('search='));
    expect(searches).toHaveLength(1); // debounced: one request, not one per keystroke
  });

  it('shows an empty state for no results and an error state with retry', async () => {
    server.state.failNext = { status: 503, body: { status: false } };
    renderRouter(APP_DIR, { initialUrl: '/counsellors' });
    expect(await screen.findByTestId('error-state')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Test Counsellor One')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByTestId('counsellor-search'), 'zzzz-nobody');
    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(await screen.findByText('No counsellors found')).toBeOnTheScreen();
  });

  it('opens a counsellor profile and starts booking from it', async () => {
    renderRouter(APP_DIR, { initialUrl: '/counsellor/1' });
    expect(await screen.findByText('Areas of Expertise')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('profile-book'));
    expect(await screen.findByTestId('confirm-booking')).toBeOnTheScreen();
  });
});

describe('profile', () => {
  it('edits the profile with validation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderRouter(APP_DIR, { initialUrl: '/edit-profile' });
    fireEvent.changeText(await screen.findByTestId('mobile'), '12345');
    fireEvent.press(screen.getByTestId('save-profile'));
    expect(await screen.findByText('Enter a valid 10-digit Indian mobile number.')).toBeOnTheScreen();
    expect(server.state.calls.some((c) => c.method === 'PATCH')).toBe(false);

    fireEvent.changeText(screen.getByTestId('first-name'), 'Harshini');
    fireEvent.changeText(screen.getByTestId('mobile'), '98765 43210');
    fireEvent.press(screen.getByTestId('save-profile'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Profile updated', expect.any(String)));
    const patch = server.state.calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toEqual({ firstName: 'Harshini', lastName: 'Verma', mobile: '+919876543210' });
    expect((await sessionStore.load())?.user.firstName).toBe('Harshini');
  });

  it('deletes the account: server request, local data wiped, signed out', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await journalStore.add({ text: 'private', prompt: null, mood: null });
    await goalStore.add('Sleep early');
    renderRouter(APP_DIR, { initialUrl: '/delete-account' });
    const button = await screen.findByTestId('delete-account');
    expect(button).toBeDisabled();
    fireEvent.changeText(screen.getByTestId('delete-confirm'), 'delete');
    await act(async () => {
      fireEvent.press(screen.getByTestId('delete-account'));
    });
    expect(await screen.findByTestId('get-started')).toBeOnTheScreen();
    expect(server.state.deletionRequests).toEqual(['harsha@fixturecorp.com']);
    expect(await journalStore.all()).toEqual([]);
    expect(await goalStore.all()).toEqual([]);
    expect(await sessionStore.load()).toBeNull();
  });
});

describe('content', () => {
  it('shows assessments and articles on Explore and opens an article', async () => {
    renderRouter(APP_DIR, { initialUrl: '/explore' });
    expect(await screen.findByText('Stress Level Check')).toBeOnTheScreen();
    fireEvent.press(await screen.findByTestId('article-1'));
    expect(await screen.findByText('First paragraph.')).toBeOnTheScreen();
    expect(screen.getByText('Second & last.')).toBeOnTheScreen();
  });

  it('filters articles by category and paginates', async () => {
    renderRouter(APP_DIR, { initialUrl: '/articles' });
    expect(await screen.findByTestId('article-2')).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId('load-more'));
    await waitFor(() => expect(server.state.calls.some((c) => c.url.includes('page=2'))).toBe(true));
    fireEvent.press(screen.getByTestId('category-Anxiety'));
    await waitFor(() => expect(screen.queryByTestId('article-1')).toBeNull());
    expect(screen.getByTestId('article-2')).toBeOnTheScreen();
  });

  it('shows an article-not-found error', async () => {
    renderRouter(APP_DIR, { initialUrl: '/articles/999' });
    expect(await screen.findByTestId('error-state')).toBeOnTheScreen();
  });

  it('completes an assessment and stores the result locally', async () => {
    renderRouter(APP_DIR, { initialUrl: '/assessments/1' });
    fireEvent.press(await screen.findByTestId('start-assessment'));
    expect(screen.getByTestId('next-question')).toBeDisabled();
    fireEvent.press(screen.getByTestId('option-b'));
    fireEvent.press(screen.getByTestId('next-question'));
    fireEvent.press(screen.getByTestId('option-d'));
    fireEvent.press(screen.getByTestId('submit-assessment'));
    expect(await screen.findByTestId('assessment-score')).toHaveTextContent('100%');
    expect(screen.getByText('Moderate')).toBeOnTheScreen();
    const submit = server.state.calls.find((c) => c.path === 'assessments/1/submit');
    expect(submit?.body).toEqual({
      answers: [
        { questionId: 'q1', optionId: 'b' },
        { questionId: 'q2', optionId: 'd' },
      ],
    });
  });
});

describe('wellbeing tools (on-device)', () => {
  it('saves a journal entry without sending it to the server', async () => {
    renderRouter(APP_DIR, { initialUrl: '/journal' });
    fireEvent.changeText(await screen.findByTestId('journal-input'), 'Felt calmer today');
    await act(async () => {
      fireEvent.press(screen.getByTestId('save-journal'));
    });
    expect(await screen.findByText('Felt calmer today')).toBeOnTheScreen();
    expect(JSON.stringify(server.state.calls)).not.toContain('Felt calmer today');
  });

  it('runs a breathing exercise to completion and logs it', async () => {
    renderRouter(APP_DIR, { initialUrl: '/breathing/panic-reset' });
    fireEvent.press(await screen.findByTestId('toggle-breathing'));
    act(() => {
      jest.advanceTimersByTime(61_000);
    });
    expect(await screen.findByText('Well done!')).toBeOnTheScreen();
  });
});

describe('Talk to Us', () => {
  it('opens WhatsApp for +91 7200500221', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderRouter(APP_DIR, { initialUrl: '/talk-to-us' });
    fireEvent.press(await screen.findByTestId('whatsapp'));
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/917200500221\?text=/));
  });

  it('asks for confirmation before opening the dialer', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderRouter(APP_DIR, { initialUrl: '/talk-to-us' });
    fireEvent.press(await screen.findByTestId('call-now'));
    expect(open).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][0]).toBe('Call 1800 121 9497?');
    alert.mock.calls[0][2]![1].onPress!();
    expect(open).toHaveBeenCalledWith('tel:18001219497');
  });
});

describe('navigation', () => {
  it('has all five tabs with the Ally placeholder (Phase 2)', async () => {
    renderRouter(APP_DIR, { initialUrl: '/ally' });
    expect(await screen.findByTestId('ally-coming-soon')).toBeOnTheScreen();
    for (const label of ['Home', 'Explore', 'Ally', 'Counsellor', 'Profile']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});
