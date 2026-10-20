/** Explore taxonomy from the approved design. Category names are sent to the API as-is. */
export const CONTENT_CATEGORIES = ['All', 'Stress', 'Anxiety', 'Sleep', 'Workplace', 'Relationships'] as const;

export const CATEGORY_EMOJI: Record<string, string> = {
  All: '⊞',
  Stress: '😐',
  Anxiety: '😟',
  Sleep: '🌙',
  Workplace: '💼',
  Relationships: '👥',
};

export const WORKPLACE_TOPICS = [
  { title: 'POSH Awareness', emoji: '🛡️' },
  { title: 'Diversity & Inclusion', emoji: '🤝' },
  { title: 'Psychological Safety', emoji: '💚' },
  { title: 'Conflict Resolution', emoji: '💬' },
  { title: 'Manager Empathy', emoji: '👔' },
  { title: 'Respect at Work', emoji: '🫱' },
] as const;

export function categoryParam(category: string): string | undefined {
  return category === 'All' ? undefined : category;
}
