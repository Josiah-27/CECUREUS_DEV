/** Appends a page to a list, dropping items already present (offset paging can repeat items when content shifts). */
export function appendUnique<T extends { id: string }>(existing: T[], page: T[]): T[] {
  const seen = new Set(existing.map((i) => i.id));
  return [...existing, ...page.filter((i) => !seen.has(i.id) && (seen.add(i.id), true))];
}
