import type { ArticleSummary } from '@/api/schemas';
import { savedArticleStore } from '@/local/stores';

import { useLocalCollection } from './use-local';

/** Bookmark state for article cards (stored on device only). */
export function useSavedArticles() {
  const saved = useLocalCollection(() => savedArticleStore.all());
  const ids = new Set(saved.items.map((a) => a.id));

  async function toggle(a: Pick<ArticleSummary, 'id' | 'title' | 'category' | 'readMinutes' | 'imageUrl'>) {
    saved.setItems(
      await savedArticleStore.toggle({
        id: a.id,
        title: a.title,
        category: a.category,
        readMinutes: a.readMinutes,
        imageUrl: a.imageUrl,
      }),
    );
  }

  return { items: saved.items, isSaved: (id: string) => ids.has(id), toggle };
}
