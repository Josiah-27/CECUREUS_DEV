export const DAILY_TIPS = [
  "You don't have to control your thoughts. You just have to stop letting them control you.",
  'Small steps every day add up to big changes.',
  'It is okay to rest. Rest is productive too.',
  'Talking about how you feel is a sign of strength, not weakness.',
  'Take three slow breaths before you respond to something stressful.',
  'Progress, not perfection.',
  'Be as kind to yourself as you would be to a good friend.',
];

/** Same tip all day, rotating daily. */
export function tipForDate(date: Date = new Date()): string {
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return DAILY_TIPS[dayNumber % DAILY_TIPS.length];
}
