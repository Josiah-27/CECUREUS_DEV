import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Counsellor } from '@/api/schemas';
import { CounsellorCard } from '@/components/counsellor-card';
import { EmergencyBanner } from '@/components/emergency-banner';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, LoadingState, TextField } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useQuery } from '@/hooks/use-query';
import { appendUnique } from '@/lib/collections';
import { openWhatsApp } from '@/lib/contact';
import { useApi } from '@/providers/api-provider';
import { colors, spacing } from '@/theme';

const EXPERTISE_FILTERS = ['All', 'Anxiety', 'Stress', 'Depression', 'Workplace', 'Relationship', 'Parenting', 'Grief'];

export default function CounsellorsScreen() {
  const api = useApi();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const debounced = useDebouncedValue(search.trim(), 300);
  // Extra pages are tied to the list key so changing search/filter discards them.
  const listKey = JSON.stringify([debounced, filter]);
  const [extraState, setExtra] = useState<{ key: string; items: Counsellor[]; nextPage: number | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const extra = extraState?.key === listKey ? extraState : null;

  const query = useQuery(
    (signal) =>
      api.counsellors.list({ search: debounced || undefined, expertise: filter === 'All' ? undefined : filter }, signal),
    [debounced, filter],
  );

  const items = appendUnique(query.data?.items ?? [], extra?.items ?? []);
  const nextPage = extra ? extra.nextPage : (query.data?.nextPage ?? null);

  async function loadMore() {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.counsellors.list({
        search: debounced || undefined,
        expertise: filter === 'All' ? undefined : filter,
        page: nextPage,
      });
      setExtra({ key: listKey, items: [...(extra?.items ?? []), ...page.items], nextPage: page.nextPage });
    } catch {
      // Keep the current list; the user can scroll again to retry.
    } finally {
      setLoadingMore(false);
    }
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <AppText variant="display">Our Counsellors</AppText>
        <AppText color={colors.textMuted}>Connect confidentially with our certified mental health experts.</AppText>
      </View>
      <EmergencyBanner />
      <AppText variant="heading">Find the right support for you</AppText>
      <TextField
        testID="counsellor-search"
        label="Search"
        placeholder="Search by name, expertise, language…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        autoCorrect={false}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {EXPERTISE_FILTERS.map((f) => (
          <Chip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} testID={`filter-${f}`} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        testID="counsellor-list"
        data={query.loading || query.error ? [] : items}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CounsellorCard counsellor={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        keyboardShouldPersistTaps="handled"
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={false}
        onRefresh={query.reload}
        ListEmptyComponent={
          query.loading ? (
            <LoadingState label="Finding counsellors…" />
          ) : query.error ? (
            <ErrorState error={query.error} onRetry={query.reload} />
          ) : (
            <EmptyState
              title="No counsellors found"
              message="Try a different search or filter."
              icon="search-outline"
              action={
                search || filter !== 'All'
                  ? {
                      label: 'Clear filters',
                      onPress: () => {
                        setSearch('');
                        setFilter('All');
                      },
                    }
                  : undefined
              }
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {loadingMore ? <LoadingState label="Loading more…" /> : null}
            <Card tone="soft">
              <View style={styles.match}>
                <Ionicons name="people-outline" size={24} color={colors.primary} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">Can&apos;t find the right match?</AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    Our care team will help you find the most suitable counsellor.
                  </AppText>
                </View>
              </View>
              <Button
                compact
                variant="outline"
                label="Get Matched on WhatsApp"
                onPress={() => void openWhatsApp('Hi CecureUs, please help me find the right counsellor.')}
                style={styles.matchButton}
              />
            </Card>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { gap: spacing.lg, marginBottom: spacing.lg },
  titleBlock: { gap: spacing.xs },
  chips: { gap: spacing.sm },
  footer: { marginTop: spacing.xl, gap: spacing.lg },
  match: { flexDirection: 'row', gap: spacing.md },
  matchButton: { marginTop: spacing.md },
  flex: { flex: 1 },
});
