import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ArticleCard } from '@/components/article-card';
import { EmergencyBanner } from '@/components/emergency-banner';
import { AppText, Card, Chip, EmptyState, ErrorState, LoadingState, Screen, SectionHeader, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { BREATHING_EXERCISES } from '@/lib/breathing';
import { categoryParam, CONTENT_CATEGORIES, WORKPLACE_TOPICS } from '@/lib/content';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

export default function ExploreScreen() {
  const api = useApi();
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const assessments = useQuery(() => api.assessments.list(), []);
  const articles = useQuery(() => api.content.articles({ category: categoryParam(category) }), [category]);

  function submitSearch() {
    const q = search.trim();
    if (q) router.push({ pathname: '/articles', params: { search: q } });
  }

  return (
    <Screen testID="explore-screen">
      <View style={styles.title}>
        <AppText variant="display">Explore</AppText>
        <AppText color={colors.textMuted}>Discover resources to understand, heal and grow.</AppText>
      </View>

      <TextField
        label="Search"
        placeholder="Search blogs and articles…"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
        onSubmitEditing={submitSearch}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {CONTENT_CATEGORIES.map((c) => (
          <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} testID={`category-${c}`} />
        ))}
      </ScrollView>

      <View style={styles.section}>
        <SectionHeader
          title="Self Assessments"
          subtitle="Understand your current mental well-being."
          onAction={() => router.push('/assessments')}
        />
        {assessments.loading ? (
          <LoadingState />
        ) : assessments.error ? (
          <ErrorState error={assessments.error} onRetry={assessments.reload} />
        ) : !assessments.data?.length ? (
          <EmptyState title="Assessments coming soon" icon="clipboard-outline" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {assessments.data.map((a) => (
              <Card
                key={a.id}
                style={styles.assessment}
                accessibilityLabel={`${a.title}. ${a.description ?? ''}`}
                onPress={() => router.push({ pathname: '/assessments/[id]', params: { id: a.id } })}
              >
                <Ionicons name="clipboard-outline" size={28} color={colors.primary} />
                <AppText variant="bodyStrong">{a.title}</AppText>
                {a.description ? (
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
                    {a.description}
                  </AppText>
                ) : null}
                {a.estimatedMinutes ? (
                  <AppText variant="caption" color={colors.textMuted}>
                    ⏱ {a.estimatedMinutes} mins
                  </AppText>
                ) : null}
              </Card>
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Blogs & Articles"
          subtitle="Curated reads by experts to support your journey."
          onAction={() => router.push({ pathname: '/articles', params: { category } })}
        />
        {articles.loading ? (
          <LoadingState />
        ) : articles.error ? (
          <ErrorState error={articles.error} onRetry={articles.reload} />
        ) : !articles.data?.items.length ? (
          <EmptyState title="No articles yet" message="Check back soon for new reads." icon="reader-outline" />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {articles.data.items.slice(0, 6).map((a) => (
              <ArticleCard key={a.id} article={a} horizontal />
            ))}
          </ScrollView>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.push('/videos')} style={styles.videos}>
          <Ionicons name="play-circle-outline" size={24} color={colors.primary} />
          <AppText variant="bodyStrong" color={colors.primary}>
            Watch wellness videos
          </AppText>
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Guided Wellness Activities"
          subtitle="Short activities to relax, recharge and reset."
          onAction={() => router.push('/breathing')}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {BREATHING_EXERCISES.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`${e.title}, ${Math.round(e.totalSeconds / 60)} minutes`}
              onPress={() => router.push({ pathname: '/breathing/[id]', params: { id: e.id } })}
              style={styles.activity}
            >
              <Ionicons name={e.icon} size={30} color={colors.primary} />
              <AppText variant="label" align="center">
                {e.title}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {Math.round(e.totalSeconds / 60)} mins
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Workplace Wellbeing"
          subtitle="Resources for a healthier and more respectful workplace."
          onAction={() => router.push({ pathname: '/articles', params: { category: 'Workplace' } })}
        />
        <View style={styles.topics}>
          {WORKPLACE_TOPICS.map((t) => (
            <Pressable
              key={t.title}
              accessibilityRole="button"
              accessibilityLabel={t.title}
              onPress={() => router.push({ pathname: '/articles', params: { search: t.title } })}
              style={styles.topic}
            >
              <Ionicons name={t.icon} size={26} color={colors.primary} />
              <AppText variant="caption" align="center">
                {t.title}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <EmergencyBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { gap: spacing.xs },
  row: { gap: spacing.sm },
  section: { gap: spacing.md },
  assessment: { width: 170, gap: spacing.xs },
  videos: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  activity: {
    width: 104,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  topics: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  topic: { width: '33.33%', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, minHeight: 64 },
});
