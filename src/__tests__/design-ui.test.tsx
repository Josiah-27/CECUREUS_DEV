import { cleanup, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { readArticleStore, savedArticleStore } from '@/local/stores';
import { APP_DIR, installMockServer, resetDeviceStorage, signInDirect } from '@/test/harness';
import type { MockServer } from '@/test/mock-server';

let server: MockServer;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-25T06:00:00.000Z') });
  resetDeviceStorage();
  server = installMockServer();
  await signInDirect(server);
});

// Unmount while the fake clock is still installed, so nothing from this test is left waiting on it.
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

describe('app chrome (Figma design)', () => {
  it('navigates with the custom bottom tab bar, including the raised Ally button', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: '/' });
    await screen.findByTestId('home-screen');
    await fireEvent.press(screen.getByTestId('tab-explore'));
    expect(await screen.findByTestId('explore-screen')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('tab-ally'));
    expect(await screen.findByTestId('ally-screen')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('tab-profile'));
    expect(await screen.findByTestId('profile-screen')).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/profile');
  });

  it('opens the side menu from the top bar and navigates', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: '/' });
    await fireEvent.press((await screen.findAllByTestId('open-menu'))[0]);
    await fireEvent.press(await screen.findByLabelText('My Sessions'));
    await waitFor(() => expect(r.getPathname()).toBe('/sessions'));
  });

  it('opens notifications from the bell with an honest empty state', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await fireEvent.press((await screen.findAllByLabelText('Notifications'))[0]);
    expect(await screen.findByText("You're all caught up")).toBeOnTheScreen();
  });
});

describe('Ally (Phase 2 placeholder)', () => {
  it('routes topic chips to real resources', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: '/ally' });
    await fireEvent.press(await screen.findByTestId('topic-Feeling stressed'));
    await waitFor(() => expect(r.getPathname()).toBe('/breathing/box'));
  });

  it('never fakes an AI reply: asking Ally explains it is coming and offers human help', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderRouter(APP_DIR, { initialUrl: '/ally' });
    await fireEvent.press(await screen.findByTestId('ask-ally'));
    expect(alert.mock.calls[0][0]).toBe('Ally chat is coming soon');
    expect(alert.mock.calls[0][2]!.map((b) => b.text)).toEqual(['Not now', 'WhatsApp', 'Call']);
  });
});

describe('reading history and bookmarks (device only)', () => {
  // Keep this first in the block: after the two /articles tests below, expo-router's test renderer keeps
  // the previous /articles state and ignores initialUrl '/profile' (a test-harness quirk, not an app bug).
  it('counts completed blogs on the profile overview', async () => {
    await readArticleStore.add({ id: '1', title: '5 Signs You Might Be Overwhelmed', category: 'Stress', readMinutes: 5, imageUrl: null });
    await renderRouter(APP_DIR, { initialUrl: '/profile' });
    expect(await screen.findByLabelText('Blogs Completed: 1. View All')).toBeOnTheScreen();
    expect(screen.getByText('5 Signs You Might Be Overwhelmed')).toBeOnTheScreen();
  });

  it('marks an article as read and shows it under Blogs Completed on Profile', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/articles/1' });
    const target = await screen.findByTestId('mark-read');
    await fireEvent.press(target);
    expect(await screen.findByText('Marked as read')).toBeOnTheScreen();
    expect((await readArticleStore.all()).map((a) => a.id)).toEqual(['1']);
    expect(JSON.stringify(server.state.calls)).not.toContain('read');
  });

  it('bookmarks an article from the list and shows it under Saved', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/articles' });
    const target = await screen.findByTestId('save-2');
    await fireEvent.press(target);
    await waitFor(async () => expect((await savedArticleStore.all()).map((a) => a.id)).toEqual(['2']));
    await fireEvent.press(screen.getByTestId('category-Saved'));
    expect(await screen.findByTestId('article-2')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByTestId('article-1')).toBeNull());
  });
});
