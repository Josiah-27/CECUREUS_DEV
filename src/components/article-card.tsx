import { Image } from 'expo-image';
import { router } from 'expo-router';
import Bookmark from 'lucide-react-native/icons/bookmark';
import CheckCircle from 'lucide-react-native/icons/circle-check-big';
import Clock from 'lucide-react-native/icons/clock';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ArticleSummary } from '@/api/schemas';
import { resolveMediaUrl } from '@/lib/media';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

import { AppText } from './ui';

const PLACEHOLDER_EMOJI = ['🧘', '🌿', '🤝', '🌙'];

function emojiFor(id: string) {
  let n = 0;
  for (const ch of id) n += ch.charCodeAt(0);
  return { emoji: PLACEHOLDER_EMOJI[n % PLACEHOLDER_EMOJI.length], tint: n % 2 === 0 ? colors.tealLight : colors.amberLight };
}

type Props = {
  article: Pick<ArticleSummary, 'id' | 'title' | 'category' | 'readMinutes' | 'imageUrl'> & { excerpt?: string | null };
  horizontal?: boolean;
  saved?: boolean;
  completed?: boolean;
  onToggleSave?: () => void;
  footnote?: string;
};

export function ArticleCard({ article, horizontal = false, saved, completed, onToggleSave, footnote }: Props) {
  const image = resolveMediaUrl(article.imageUrl);
  const placeholder = emojiFor(article.id);
  const cover = (
    <View style={[horizontal ? styles.coverH : styles.coverV, { backgroundColor: placeholder.tint }]}>
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <AppText style={styles.emoji} aria-hidden>
          {placeholder.emoji}
        </AppText>
      )}
      {completed ? (
        <View style={styles.check}>
          <CheckCircle size={12} color="#FFFFFF" />
        </View>
      ) : null}
    </View>
  );

  const bookmark = onToggleSave ? (
    <Pressable
      testID={`save-${article.id}`}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save for later'}
      accessibilityState={{ selected: !!saved }}
      onPress={onToggleSave}
      hitSlop={10}
    >
      <Bookmark size={14} color={saved ? colors.amber : colors.textMuted} fill={saved ? colors.amber : 'transparent'} />
    </Pressable>
  ) : null;

  return (
    <Pressable
      testID={`article-${article.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}${article.readMinutes ? `, ${article.readMinutes} minute read` : ''}`}
      onPress={() => router.push({ pathname: '/articles/[id]', params: { id: article.id } })}
      style={({ pressed }) => [horizontal ? styles.cardH : styles.cardV, shadow.card, pressed && { opacity: 0.85 }]}
    >
      {cover}
      <View style={horizontal ? styles.bodyH : styles.bodyV}>
        {article.category ? (
          <AppText variant="micro" color="#B45309">
            {article.category}
          </AppText>
        ) : null}
        <AppText variant="label" numberOfLines={2} style={styles.title}>
          {article.title}
        </AppText>
        {!horizontal && article.excerpt ? (
          <AppText variant="caption" color={colors.textMuted} numberOfLines={2}>
            {article.excerpt}
          </AppText>
        ) : null}
        {footnote ? (
          <AppText variant="micro" color={colors.textMuted}>
            {footnote}
          </AppText>
        ) : null}
        <View style={styles.meta}>
          {article.readMinutes ? (
            <View style={styles.time}>
              <Clock size={10} color={colors.textMuted} />
              <AppText variant="micro" color={colors.textMuted}>
                {article.readMinutes} min read
              </AppText>
            </View>
          ) : (
            <View />
          )}
          {bookmark}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardH: {
    width: 150,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardV: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  coverH: { height: 84, alignItems: 'center', justifyContent: 'center' },
  coverV: { width: 96, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 30, lineHeight: 38 },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyH: { padding: spacing.sm, gap: 2 },
  bodyV: { flex: 1, padding: spacing.md, gap: 2 },
  title: { fontFamily: fonts.bold },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
