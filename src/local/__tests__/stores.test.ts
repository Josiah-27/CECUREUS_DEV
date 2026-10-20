import * as SecureStore from 'expo-secure-store';

import { readJson, removeJson, writeJson } from '../secure-json-store';
import {
  clearAllLocalData,
  goalStore,
  JournalFullError,
  journalStore,
  MAX_JOURNAL_ENTRIES,
  moodStore,
} from '../stores';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => store.clear());

describe('secure JSON store', () => {
  it('round-trips large values across chunks and cleans up stale chunks', async () => {
    const big = { text: 'x'.repeat(5000) };
    await writeJson('k', big);
    expect(Number(store.get('k.n'))).toBeGreaterThan(1);
    expect(await readJson('k', null)).toEqual(big);

    await writeJson('k', { text: 'small' });
    expect(store.get('k.n')).toBe('1');
    expect(store.has('k.1')).toBe(false);
    expect(await readJson('k', null)).toEqual({ text: 'small' });
  });

  it('returns the fallback for missing or corrupt data', async () => {
    expect(await readJson('missing', [])).toEqual([]);
    store.set('bad.n', '1');
    store.set('bad.0', '{not json');
    expect(await readJson('bad', 'fallback')).toBe('fallback');
  });

  it('removes all chunks', async () => {
    await writeJson('k', { text: 'y'.repeat(4000) });
    await removeJson('k');
    expect([...store.keys()].filter((key) => key.startsWith('k.'))).toEqual([]);
  });
});

describe('journal', () => {
  it('adds newest first, trims and rejects empty entries', async () => {
    await journalStore.add({ text: ' first ', prompt: null, mood: null });
    const entries = await journalStore.add({ text: 'second', prompt: 'What made you smile today?', mood: 'good' });
    expect(entries.map((e) => e.text)).toEqual(['second', 'first']);
    await expect(journalStore.add({ text: '   ', prompt: null, mood: null })).rejects.toThrow();
  });

  it('deletes entries', async () => {
    const [entry] = await journalStore.add({ text: 'to delete', prompt: null, mood: null });
    expect(await journalStore.remove(entry.id)).toEqual([]);
  });

  it('refuses new entries when full instead of silently dropping old ones', async () => {
    const full = Array.from({ length: MAX_JOURNAL_ENTRIES }, (_, i) => ({
      id: String(i),
      createdAt: '2026-01-01T00:00:00Z',
      prompt: null,
      text: 'e',
      mood: null,
    }));
    await journalStore.save(full);
    await expect(journalStore.add({ text: 'one more', prompt: null, mood: null })).rejects.toBeInstanceOf(
      JournalFullError,
    );
    expect(await journalStore.all()).toHaveLength(MAX_JOURNAL_ENTRIES);
  });
});

describe('goals and moods', () => {
  it('toggles daily completion', async () => {
    const [goal] = await goalStore.add('Drink more water');
    let goals = await goalStore.toggleDay(goal.id, '2026-11-10');
    expect(goals[0].completions).toEqual(['2026-11-10']);
    goals = await goalStore.toggleDay(goal.id, '2026-11-10');
    expect(goals[0].completions).toEqual([]);
  });

  it('records moods and clears all local data', async () => {
    await moodStore.record('good');
    await goalStore.add('Sleep before 11 PM');
    await clearAllLocalData();
    expect(await moodStore.all()).toEqual([]);
    expect(await goalStore.all()).toEqual([]);
  });
});
