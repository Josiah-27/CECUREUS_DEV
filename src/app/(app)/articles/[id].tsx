import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { Share, StyleSheet, View } from 'react-native';

import { AppText, Button, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { htmlToParagraphs } from '@/lib/html';
import { resolveMediaUrl } from '@/lib/media';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const query = useQuery(() => api.content.article(String(id)), [id]);

  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;
  const a = query.data;
  const image = resolveMediaUrl(a.imageUrl);
  const paragraphs = htmlToParagraphs(a.contentHtml);

  return (
    <Screen edges={['bottom']}>
      {image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
      <View style={styles.meta}>
        {a.category ? (
          <AppText variant="label" color={colors.primary}>
            {a.category}
          </AppText>
        ) : null}
        <AppText variant="title">{a.title}</AppText>
        {a.readMinutes ? (
          <AppText variant="caption" color={colors.textMuted}>
            {a.readMinutes} min read
          </AppText>
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
        variant="outline"
        label="Share"
        onPress={() => void Share.share({ message: `${a.title} — read it on the CecureUs app.` })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: colors.surface },
  meta: { gap: spacing.xs },
  body: { gap: spacing.lg },
  paragraph: { fontSize: 16, lineHeight: 26 },
});
