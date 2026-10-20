/** Explore taxonomy from the approved design. Category names are sent to the API as-is. */
export const CONTENT_CATEGORIES = ['All', 'Stress', 'Anxiety', 'Sleep', 'Workplace', 'Relationships'] as const;

export const WORKPLACE_TOPICS = [
  { title: 'POSH Awareness', icon: 'shield-checkmark-outline' },
  { title: 'Diversity & Inclusion', icon: 'people-outline' },
  { title: 'Psychological Safety', icon: 'heart-outline' },
  { title: 'Conflict Resolution', icon: 'chatbubbles-outline' },
  { title: 'Manager Empathy', icon: 'person-outline' },
  { title: 'Respect at Work', icon: 'hand-left-outline' },
] as const;

export function categoryParam(category: string): string | undefined {
  return category === 'All' ? undefined : category;
}
