import { randomUUID } from 'expo-crypto';

import { readJson, removeJson, writeJson } from './secure-json-store';

export type Mood = 'good' | 'anxious' | 'low' | 'stressed' | 'exhausted';
export const MOODS: { id: Mood; label: string; emoji: string; score: number }[] = [
  { id: 'good', label: 'Good', emoji: '🙂', score: 5 },
  { id: 'anxious', label: 'Anxious', emoji: '😟', score: 2 },
  { id: 'low', label: 'Low', emoji: '😔', score: 2 },
  { id: 'stressed', label: 'Stressed', emoji: '😣', score: 1 },
  { id: 'exhausted', label: 'Exhausted', emoji: '😩', score: 1 },
];

export type MoodEntry = { at: string; mood: Mood };
export type JournalEntry = { id: string; createdAt: string; prompt: string | null; text: string; mood: Mood | null };
export type Goal = { id: string; title: string; createdAt: string; completions: string[]; archived: boolean };
export type ActivityLog = { id: string; exerciseId: string; completedAt: string; moodAfter: Mood | null };
export type AssessmentLog = { assessmentId: string; title: string; completedAt: string; percentage: number; level: string };

const KEYS = {
  moods: 'cecureus.local.moods',
  journal: 'cecureus.local.journal',
  goals: 'cecureus.local.goals',
  activities: 'cecureus.local.activities',
  assessments: 'cecureus.local.assessments',
} as const;

export const MAX_JOURNAL_LENGTH = 5000;
export const MAX_JOURNAL_ENTRIES = 200;

export class JournalFullError extends Error {
  constructor() {
    super(`You can keep up to ${MAX_JOURNAL_ENTRIES} entries. Delete older entries to add new ones.`);
    this.name = 'JournalFullError';
  }
}
const MAX_ITEMS = 500;

function collection<T>(key: string) {
  return {
    all: () => readJson<T[]>(key, []),
    save: (items: T[]) => writeJson(key, items.slice(0, MAX_ITEMS)),
  };
}

export const moodStore = {
  ...collection<MoodEntry>(KEYS.moods),
  async record(mood: Mood, at: Date = new Date()) {
    const items = await this.all();
    const next = [{ at: at.toISOString(), mood }, ...items];
    await this.save(next);
    return next;
  },
};

export const journalStore = {
  ...collection<JournalEntry>(KEYS.journal),
  async add(input: { text: string; prompt: string | null; mood: Mood | null }) {
    const text = input.text.trim().slice(0, MAX_JOURNAL_LENGTH);
    if (!text) throw new Error('Journal entry is empty');
    const existing = await this.all();
    if (existing.length >= MAX_JOURNAL_ENTRIES) throw new JournalFullError();
    const entry: JournalEntry = { id: randomUUID(), createdAt: new Date().toISOString(), ...input, text };
    const next = [entry, ...existing];
    await this.save(next);
    return next;
  },
  async remove(id: string) {
    const next = (await this.all()).filter((e) => e.id !== id);
    await this.save(next);
    return next;
  },
};

export const goalStore = {
  ...collection<Goal>(KEYS.goals),
  async add(title: string) {
    const clean = title.trim().slice(0, 80);
    if (!clean) throw new Error('Goal title is empty');
    const goal: Goal = { id: randomUUID(), title: clean, createdAt: new Date().toISOString(), completions: [], archived: false };
    const next = [goal, ...(await this.all())];
    await this.save(next);
    return next;
  },
  async toggleDay(id: string, ymd: string) {
    const next = (await this.all()).map((g) =>
      g.id !== id
        ? g
        : {
            ...g,
            completions: g.completions.includes(ymd)
              ? g.completions.filter((d) => d !== ymd)
              : [...g.completions, ymd],
          },
    );
    await this.save(next);
    return next;
  },
  async setArchived(id: string, archived: boolean) {
    const next = (await this.all()).map((g) => (g.id === id ? { ...g, archived } : g));
    await this.save(next);
    return next;
  },
  async remove(id: string) {
    const next = (await this.all()).filter((g) => g.id !== id);
    await this.save(next);
    return next;
  },
};

export const activityStore = {
  ...collection<ActivityLog>(KEYS.activities),
  async log(exerciseId: string, moodAfter: Mood | null) {
    const next = [{ id: randomUUID(), exerciseId, completedAt: new Date().toISOString(), moodAfter }, ...(await this.all())];
    await this.save(next);
    return next;
  },
};

export const assessmentLogStore = {
  ...collection<AssessmentLog>(KEYS.assessments),
  async log(entry: AssessmentLog) {
    const next = [entry, ...(await this.all())];
    await this.save(next);
    return next;
  },
};

/** Wipes all on-device personal data (used on account deletion). */
export async function clearAllLocalData() {
  await Promise.all(Object.values(KEYS).map((k) => removeJson(k)));
}
