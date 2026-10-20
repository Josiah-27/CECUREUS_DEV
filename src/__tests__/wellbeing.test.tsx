import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as WebBrowser from 'expo-web-browser';

import { goalStore, moodStore } from '@/local/stores';
import { resolveMediaUrl } from '@/lib/media';
import { moodTrend } from '@/lib/progress';
import { tipForDate } from '@/lib/tips';
import { APP_DIR, installMockServer, resetDeviceStorage, signInDirect } from '@/test/harness';
import type { MockServer } from '@/test/mock-server';

let server: MockServer;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-25T06:00:00.000Z') });
  resetDeviceStorage();
  server = installMockServer();
  await signInDirect(server);
});

afterEach(() => jest.useRealTimers());

describe('goals', () => {
  it('adds a goal, marks it done today and shows the streak', async () => {
    renderRouter(APP_DIR, { initialUrl: '/goals' });
    fireEvent.changeText(await screen.findByTestId('goal-input'), 'Drink more water');
    await act(async () => {
      fireEvent.press(screen.getByTestId('add-goal'));
    });
    expect(await screen.findByText('Drink more water')).toBeOnTheScreen();
    expect(screen.getByText('Start your streak today')).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Mark Drink more water done for today'));
    });
    expect(await screen.findByText('1 day streak')).toBeOnTheScreen();
    expect((await goalStore.all())[0].completions).toHaveLength(1);
  });
});

describe('progress', () => {
  it('shows mood check-ins and weekly counts', async () => {
    await moodStore.record('good', new Date('2026-10-24T08:00:00.000Z'));
    await moodStore.record('stressed', new Date('2026-10-25T05:00:00.000Z'));
    renderRouter(APP_DIR, { initialUrl: '/progress' });
    expect(await screen.findByLabelText('Mood trend for the last 7 days')).toBeOnTheScreen();
    expect(screen.getByText('Mood check-ins')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText('2')).toBeOnTheScreen());
  });

  it('computes a daily average mood trend', () => {
    const today = new Date(2026, 9, 25, 12);
    const trend = moodTrend(
      [
        { at: new Date(2026, 9, 25, 9).toISOString(), mood: 'good' },
        { at: new Date(2026, 9, 25, 10).toISOString(), mood: 'stressed' },
      ],
      3,
      today,
    );
    expect(trend.map((d) => d.score)).toEqual([null, null, 3]);
  });
});

describe('videos', () => {
  it('lists videos and opens them in the in-app browser', async () => {
    renderRouter(APP_DIR, { initialUrl: '/videos' });
    fireEvent.press(await screen.findByTestId('video-v1'));
    await waitFor(() =>
      expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://www.youtube.com/watch?v=fixture'),
    );
  });
});

describe('helpers', () => {
  it('resolves media references safely', () => {
    const base = 'https://media.example.com/uploads';
    expect(resolveMediaUrl('1633080520 Aditi.png', base)).toBe(`${base}/1633080520%20Aditi.png`);
    expect(resolveMediaUrl('https://cdn.example.com/a.png', base)).toBe('https://cdn.example.com/a.png');
    expect(resolveMediaUrl('http://insecure.example.com/a.png', base)).toBeNull();
    expect(resolveMediaUrl('javascript:alert(1)', base)).toBeNull();
    expect(resolveMediaUrl('', base)).toBeNull();
  });

  it('rotates the daily tip by date', () => {
    expect(tipForDate(new Date(2026, 9, 25))).toBe(tipForDate(new Date(2026, 9, 25, 23)));
    expect(tipForDate(new Date(2026, 9, 25))).not.toBe(tipForDate(new Date(2026, 9, 26)));
  });
});
