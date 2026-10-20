import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ArticleSummary } from '@/api/schemas';
import { resolveMediaUrl } from '@/lib/media';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './ui';

export function ArticleCard({ article, horizontal = false }: { article: ArticleSummary; horizontal?: boolean }) {
  const image = resolveMediaUrl(article.imageUrl);
  return (
    <Pressable
      testID={`article-${article.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}${article.readMinutes ? `, ${article.readMinutes} minute read` : ''}`}
      onPress={() => router.push({ pathname: '/articles/[id]', params: { id: article.id } })}
      style={({ pressed }) => [horizontal ? styles.cardH : styles.cardV, pressed && { opacity: 0.85 }]}
    >
      <View style={horizontal ? styles.imageH : styles.imageV}>
        {image ? (
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Ionicons name="reader-outline" size={32} color={colors.primary} />
        )}
      </View>
      <View style={styles.body}>
        {article.category ? (
          <AppText variant="caption" color={colors.primary}>
            {article.category}
          </AppText>
        ) : null}
        <AppText variant="bodyStrong" numberOfLines={2}>
          {article.title}
        </AppText>
        {!horizontal && article.excerpt ? (
          <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
            {article.excerpt}
          </AppText>
        ) : null}
        {article.readMinutes ? (
          <AppText variant="caption" color={colors.textMuted}>
            {article.readMinutes} min read
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardH: { width: 180, gap: spacing.sm },
  cardV: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  imageH: {
    height: 110,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageV: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: spacing.xxs },
});
