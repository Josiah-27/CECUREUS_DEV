import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { formatClock } from '@/lib/breathing';
import { resolveMediaUrl } from '@/lib/media';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

async function play(url: string) {
  if (!/^https:\/\//i.test(url)) {
    Alert.alert('Video unavailable', 'This video cannot be played right now.');
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Alert.alert('Video unavailable', 'This video cannot be played right now. Please try again later.');
  }
}

export default function VideosScreen() {
  const api = useApi();
  const query = useQuery(() => api.content.videos({}), []);

  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;
  if (!query.data.items.length) {
    return <EmptyState title="No videos yet" message="New wellness videos are on the way." icon="videocam-outline" />;
  }

  return (
    <Screen edges={['bottom']} onRefresh={query.reload}>
      {query.data.items.map((v) => {
        const thumb = resolveMediaUrl(v.thumbnailUrl);
        return (
          <Pressable
            key={v.id}
            testID={`video-${v.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Play ${v.title}`}
            onPress={() => void play(v.videoUrl)}
            style={styles.card}
          >
            <View style={styles.thumb}>
              {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <Ionicons name="play-circle" size={48} color="#FFFFFF" style={styles.play} />
              {v.durationSeconds ? (
                <View style={styles.duration}>
                  <AppText variant="caption" color="#FFFFFF">
                    {formatClock(v.durationSeconds)}
                  </AppText>
                </View>
              ) : null}
            </View>
            {v.category ? (
              <AppText variant="caption" color={colors.primary}>
                {v.category}
              </AppText>
            ) : null}
            <AppText variant="bodyStrong">{v.title}</AppText>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  thumb: {
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: { textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 8 },
  duration: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
});
