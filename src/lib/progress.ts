import { MOODS, type MoodEntry } from '@/local/stores';

import { addDays, toYmd } from './date';

/** Average mood score (1–5) per day for the last `days` days, oldest first; null where no check-in. */
export function moodTrend(entries: MoodEntry[], days: number, today: Date = new Date()) {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    const key = toYmd(new Date(e.at));
    const score = MOODS.find((m) => m.id === e.mood)?.score;
    if (score === undefined) continue;
    byDay.set(key, [...(byDay.get(key) ?? []), score]);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    const scores = byDay.get(toYmd(day));
    return {
      ymd: toYmd(day),
      label: day.toLocaleDateString('en-IN', { weekday: 'narrow' }),
      score: scores ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    };
  });
}

export function countSince<T>(items: T[], getIso: (t: T) => string, since: Date): number {
  return items.filter((i) => Date.parse(getIso(i)) >= since.getTime()).length;
}
