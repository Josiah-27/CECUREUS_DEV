import { useLocalSearchParams } from 'expo-router';
import Bookmark from 'lucide-react-native/icons/bookmark';
import Search from 'lucide-react-native/icons/search';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import type { ArticleSummary } from '@/api/schemas';
import { ArticleCard } from '@/components/article-card';
import { Button, Chip, EmptyState, ErrorState, LoadingState, SearchBar } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useQuery } from '@/hooks/use-query';
import { useSavedArticles } from '@/hooks/use-saved-articles';
import { appendUnique } from '@/lib/collections';
import { categoryParam, CONTENT_CATEGORIES } from '@/lib/content';
import { useApi } from '@/providers/api-provider';
import { colors, spacing } from '@/theme';

const SAVED = 'Saved';

export default function ArticlesScreen() {
  const params = useLocalSearchParams<{ category?: string; search?: string }>();
  const api = useApi();
  const [category, setCategory] = useState(params.category ?? 'All');
  const [search, setSearch] = useState(params.search ?? '');
  const debounced = useDebouncedValue(search.trim(), 300);
  // Extra pages are tied to the list key so changing filters discards them.
  const listKey = JSON.stringify([category, debounced]);
  const [moreState, setMore] = useState<{ key: string; items: ArticleSummary[]; nextPage: number | null; error: unknown } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const more = moreState?.key === listKey ? moreState : null;

  const saved = useSavedArticles();
  const showSaved = category === SAVED;
  const query = useQuery(
    () => api.content.articles({ category: categoryParam(category), search: debounced || undefined }),
    [category, debounced],
    { enabled: !showSaved },
  );

  const items = showSaved
    ? saved.items
        .filter((a) => !debounced || a.title.toLowerCase().includes(debounced.toLowerCase()))
        .map((a): ArticleSummary => ({ ...a, excerpt: null, publishedAt: null }))
    : appendUnique(query.data?.items ?? [], more?.items ?? []);
  const nextPage = more ? more.nextPage : (query.data?.nextPage ?? null);
  const moreError = more?.error ?? null;

  async function loadMore() {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.content.articles({
        category: categoryParam(category),
        search: debounced || undefined,
        page: nextPage,
      });
      setMore({ key: listKey, items: [...(more?.items ?? []), ...page.items], nextPage: page.nextPage, error: null });
    } catch (e) {
      setMore({ key: listKey, items: more?.items ?? [], nextPage, error: e });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.list}
      data={!showSaved && (query.loading || query.error) ? [] : items}
      keyExtractor={(a) => a.id}
      renderItem={({ item }) => (
        <ArticleCard article={item} saved={saved.isSaved(item.id)} onToggleSave={() => void saved.toggle(item)} />
      )}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <SearchBar label="Search articles" placeholder="Search articles..." value={search} onChangeText={setSearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[...CONTENT_CATEGORIES, SAVED].map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} testID={`category-${c}`} />
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        showSaved ? (
          <EmptyState title="No saved articles" message="Tap the bookmark on any article to save it for later." Icon={Bookmark} />
        ) : query.loading ? (
          <LoadingState />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.reload} />
        ) : (
          <EmptyState title="No articles found" message="Try another category or search term." Icon={Search} />
        )
      }
      ListFooterComponent={
        !showSaved && nextPage && !query.loading && !query.error ? (
          <View style={styles.footer}>
            {moreError ? <ErrorState error={moreError} /> : null}
            <Button testID="load-more" variant="outline" label="Load more" onPress={() => void loadMore()} loading={loadingMore} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.screen },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  chips: { gap: spacing.sm },
  sep: { height: spacing.md },
  footer: { marginTop: spacing.xl, gap: spacing.md },
});
