import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import Bookmark from 'lucide-react-native/icons/bookmark';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Clock from 'lucide-react-native/icons/clock';
import Share2 from 'lucide-react-native/icons/share-2';
import { Share, StyleSheet, View } from 'react-native';

import type { Article } from '@/api/schemas';
import { AppText, Button, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useLocalCollection } from '@/hooks/use-local';
import { useQuery } from '@/hooks/use-query';
import { useSavedArticles } from '@/hooks/use-saved-articles';
import { readArticleStore } from '@/local/stores';
import { htmlToParagraphs } from '@/lib/html';
import { resolveMediaUrl } from '@/lib/media';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

function refOf(a: Article) {
  return { id: a.id, title: a.title, category: a.category, readMinutes: a.readMinutes, imageUrl: a.imageUrl };
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const query = useQuery(() => api.content.article(String(id)), [id]);
  const read = useLocalCollection(() => readArticleStore.all());
  const saved = useSavedArticles();

  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;
  const a = query.data;
  const image = resolveMediaUrl(a.imageUrl);
  const paragraphs = htmlToParagraphs(a.contentHtml);
  const isRead = read.items.some((r) => r.id === a.id);
  const isSaved = saved.isSaved(a.id);

  return (
    <Screen edges={['bottom']}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <AppText style={styles.emoji} importantForAccessibility="no">
            🌿
          </AppText>
        </View>
      )}
      <View style={styles.meta}>
        {a.category ? (
          <AppText variant="label" color="#B45309">
            {a.category}
          </AppText>
        ) : null}
        <AppText variant="title">{a.title}</AppText>
        {a.readMinutes ? (
          <View style={styles.time}>
            <Clock size={12} color={colors.textMuted} />
            <AppText variant="caption" color={colors.textMuted}>
              {a.readMinutes} min read
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.body} testID="article-body">
        {paragraphs.length ? (
          paragraphs.map((p, i) => (
            <AppText key={i} style={styles.paragraph}>
              {p}
            </AppText>
          ))
        ) : (
          <AppText color={colors.textMuted}>This article has no content yet.</AppText>
        )}
      </View>
      <Button
        testID="mark-read"
        variant={isRead ? 'secondary' : 'primary'}
        label={isRead ? 'Marked as read' : 'Mark as read'}
        icon={<CheckCircle2 size={16} color={isRead ? colors.primary : '#FFFFFF'} />}
        onPress={async () => read.setItems(isRead ? await readArticleStore.remove(a.id) : await readArticleStore.add(refOf(a)))}
      />
      <View style={styles.row}>
        <Button
          testID="save-article"
          variant="outline"
          label={isSaved ? 'Saved' : 'Save for later'}
          icon={<Bookmark size={16} color={colors.primary} fill={isSaved ? colors.primary : 'transparent'} />}
          onPress={() => void saved.toggle(a)}
          style={styles.flex}
        />
        <Button
          variant="outline"
          label="Share"
          icon={<Share2 size={16} color={colors.primary} />}
          onPress={() => void Share.share({ message: `${a.title} — read it on the CecureUs app.` })}
          style={styles.flex}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: colors.surface },
  placeholder: { backgroundColor: colors.tealLight, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48, lineHeight: 58 },
  meta: { gap: spacing.xs },
  time: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { gap: spacing.lg },
  paragraph: { fontSize: 16, lineHeight: 26 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
