import { addDays, toYmd } from './date';

/**
 * Consecutive-day streak ending today (or yesterday, so a streak isn't
 * broken before the user has had a chance to complete today's goal).
 */
export function currentStreak(completedYmds: string[], today: Date = new Date()): number {
  const days = new Set(completedYmds);
  let cursor = days.has(toYmd(today)) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(toYmd(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
