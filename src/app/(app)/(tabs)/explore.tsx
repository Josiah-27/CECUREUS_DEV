import { router } from 'expo-router';
import CheckCircle from 'lucide-react-native/icons/circle-check-big';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Clock from 'lucide-react-native/icons/clock';
import PlayCircle from 'lucide-react-native/icons/circle-play';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ArticleCard } from '@/components/article-card';
import { SupportCallCard } from '@/components/emergency-banner';
import { TopNav } from '@/components/top-nav';
import { AppText, EmptyState, ErrorState, IconChip, LoadingState, Screen, SearchBar, SectionHeader } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useSavedArticles } from '@/hooks/use-saved-articles';
import { BREATHING_EXERCISES } from '@/lib/breathing';
import { CATEGORY_EMOJI, categoryParam, CONTENT_CATEGORIES, WORKPLACE_TOPICS } from '@/lib/content';
import { useApi } from '@/providers/api-provider';
import { accentCycle, colors, fonts, radius, shadow, spacing } from '@/theme';

export default function ExploreScreen() {
  const api = useApi();
  const [category, setCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const assessments = useQuery(() => api.assessments.list(), []);
  const articles = useQuery(() => api.content.articles({ category: categoryParam(category) }), [category]);
  const saved = useSavedArticles();

  function submitSearch() {
    const q = search.trim();
    if (q) router.push({ pathname: '/articles', params: { search: q } });
  }

  return (
    <Screen testID="explore-screen" header={<TopNav />}>
      <View style={styles.title}>
        <AppText variant="display">Explore</AppText>
        <AppText color={colors.textMuted}>Discover resources to understand, heal and grow.</AppText>
      </View>

      <View style={styles.searchBlock}>
        <SearchBar
          label="Search"
          placeholder="Search blogs, assessments, exercises..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={submitSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {CONTENT_CATEGORIES.map((c) => (
            <IconChip
              key={c}
              label={c}
              icon={CATEGORY_EMOJI[c]}
              selected={category === c}
              onPress={() => setCategory(c)}
              testID={`category-${c}`}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Self Assessments"
          subtitle="Understand your current mental well-being."
          icon={<CheckCircle size={14} color={colors.teal} />}
          onAction={() => router.push('/assessments')}
        />
        {assessments.loading ? (
          <LoadingState />
        ) : assessments.error ? (
          <ErrorState error={assessments.error} onRetry={assessments.reload} />
        ) : !assessments.data?.length ? (
          <EmptyState title="Assessments coming soon" />
        ) : (
          <View style={styles.grid2}>
            {assessments.data.slice(0, 4).map((a, i) => {
              const tint = accentCycle[i % 4];
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.title}. ${a.description ?? ''}`}
                  onPress={() => router.push({ pathname: '/assessments/[id]', params: { id: a.id } })}
                  style={[styles.assessment, shadow.card]}
                >
                  <AppText variant="label" style={[styles.bold, { color: tint === colors.amber ? '#B45309' : colors.text }]}>
                    {a.title}
                  </AppText>
                  <View style={[styles.assessmentIcon, { backgroundColor: `${tint}20` }]}>
                    <View style={[styles.assessmentDot, { backgroundColor: tint }]} />
                  </View>
                  {a.description ? (
                    <AppText variant="micro" color={colors.textMuted} numberOfLines={2}>
                      {a.description}
                    </AppText>
                  ) : null}
                  <View style={styles.assessmentFoot}>
                    <View style={styles.time}>
                      <Clock size={10} color={colors.textMuted} />
                      <AppText variant="micro" color={colors.textMuted}>
                        {a.estimatedMinutes ? `${a.estimatedMinutes} mins` : 'Quick'}
                      </AppText>
                    </View>
                    <ChevronRight size={12} color={colors.textMuted} />
                  </View>
                </Pressable>
              );
            })}
          </View>
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
          <EmptyState title="No articles yet" message="Check back soon for new reads." />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {articles.data.items.slice(0, 6).map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                horizontal
                saved={saved.isSaved(a.id)}
                onToggleSave={() => void saved.toggle(a)}
              />
            ))}
          </ScrollView>
        )}
        <Pressable accessibilityRole="button" onPress={() => router.push('/videos')} style={styles.videos}>
          <PlayCircle size={20} color={colors.teal} />
          <AppText variant="label" color={colors.primary}>
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
          {BREATHING_EXERCISES.map((e, i) => (
            <ActivityTile
              key={e.id}
              emoji={e.emoji}
              label={e.title}
              minutes={Math.round(e.totalSeconds / 60)}
              tint={i % 2 === 0 ? colors.tealLight : colors.amberLight}
              onPress={() => router.push({ pathname: '/breathing/[id]', params: { id: e.id } })}
            />
          ))}
          <ActivityTile
            emoji="📓"
            label="Gratitude Journaling"
            minutes={5}
            tint={colors.tealLight}
            onPress={() => router.push('/journal')}
          />
        </ScrollView>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Workplace Wellbeing"
          subtitle="Resources for a healthier and more respectful workplace."
          onAction={() => router.push({ pathname: '/articles', params: { category: 'Workplace' } })}
        />
        <View style={styles.grid3}>
          {WORKPLACE_TOPICS.map((t, i) => (
            <Pressable
              key={t.title}
              accessibilityRole="button"
              accessibilityLabel={t.title}
              onPress={() => router.push({ pathname: '/articles', params: { search: t.title } })}
              style={[styles.topic, shadow.card]}
            >
              <View style={[styles.topicIcon, { backgroundColor: i % 2 === 0 ? colors.tealLight : colors.amberLight }]}>
                <AppText style={styles.emoji} aria-hidden>
                  {t.emoji}
                </AppText>
              </View>
              <AppText variant="micro" align="center">
                {t.title}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <SupportCallCard title="Need immediate emotional support?" />
    </Screen>
  );
}

function ActivityTile({
  emoji,
  label,
  minutes,
  tint,
  onPress,
}: {
  emoji: string;
  label: string;
  minutes: number;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${minutes} minutes`}
      onPress={onPress}
      style={styles.activity}
    >
      <View style={[styles.activityIcon, { backgroundColor: tint }]}>
        <AppText style={styles.activityEmoji} aria-hidden>
          {emoji}
        </AppText>
      </View>
      <AppText variant="micro" align="center" numberOfLines={2}>
        {label}
      </AppText>
      <AppText variant="micro" color={colors.textMuted}>
        {minutes} mins
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { gap: 2 },
  searchBlock: { gap: spacing.md, marginTop: -spacing.sm },
  row: { gap: spacing.sm, paddingRight: spacing.lg },
  section: { gap: spacing.md },
  bold: { fontFamily: fonts.bold },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  assessment: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  assessmentIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  assessmentDot: { width: 16, height: 16, borderRadius: 8 },
  assessmentFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  videos: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  activity: { width: 84, alignItems: 'center', gap: 2 },
  activityIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  activityEmoji: { fontSize: 24, lineHeight: 30 },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  topic: {
    width: '31.5%',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minHeight: 84,
  },
  topicIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 18, lineHeight: 24 },
});
