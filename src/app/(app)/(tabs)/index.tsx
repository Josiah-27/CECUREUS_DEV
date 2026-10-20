import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { EmergencyBanner } from '@/components/emergency-banner';
import { FeatureTile } from '@/components/feature-tile';
import { Logo } from '@/components/logo';
import { MoodSelector } from '@/components/mood-selector';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { moodStore, type Mood } from '@/local/stores';
import { tipForDate } from '@/lib/tips';
import { colors, spacing } from '@/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const [mood, setMood] = useState<Mood | null>(null);

  function selectMood(next: Mood) {
    setMood(next);
    void moodStore.record(next);
  }

  return (
    <Screen testID="home-screen">
      <Logo height={40} />

      <View style={styles.greeting}>
        <AppText variant="display">Hi, {user?.firstName ?? 'there'} 👋</AppText>
        <AppText color={colors.textMuted}>How are you feeling today?</AppText>
        <MoodSelector value={mood} onChange={selectMood} />
        {mood && mood !== 'good' ? (
          <AppText variant="caption" color={colors.primary} testID="mood-support">
            Thanks for sharing. A short breathing exercise or a chat with a counsellor may help.
          </AppText>
        ) : null}
        <Button
          label="Start Your Wellness Journey →"
          onPress={() => router.push('/assessments')}
          accessibilityHint="Opens self assessments"
          style={styles.cta}
        />
      </View>

      {user?.userType === 'corporate' && user.companyName ? (
        <Card tone="soft">
          <AppText variant="bodyStrong">Covered by {user.companyName}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            Your counselling sessions are included in your organisation&apos;s wellness program
            {typeof user.sessionsRemaining === 'number' ? ` · ${user.sessionsRemaining} sessions remaining` : ''}.
          </AppText>
        </Card>
      ) : null}

      <View style={styles.grid}>
        <FeatureTile
          testID="tile-counsellor"
          title="Talk to a Counsellor"
          subtitle="Connect with certified counsellors"
          icon="chatbubbles-outline"
          tint={colors.primary}
          onPress={() => router.push('/counsellors')}
        />
        <FeatureTile
          testID="tile-ally"
          title="AI Ally"
          subtitle="Chat with Ally for instant support"
          icon="headset-outline"
          tint={colors.brandOrange}
          badge="Coming soon"
          onPress={() => router.push('/ally')}
        />
        <FeatureTile
          testID="tile-breathing"
          title="Breathing Exercises"
          subtitle="Relax with guided breathing"
          icon="leaf-outline"
          tint={colors.primary}
          onPress={() => router.push('/breathing')}
        />
        <FeatureTile
          testID="tile-journal"
          title="Journal"
          subtitle="Express your thoughts and feelings"
          icon="book-outline"
          tint={colors.accentYellow}
          onPress={() => router.push('/journal')}
        />
        <FeatureTile
          testID="tile-goals"
          title="My Goals"
          subtitle="Set small goals for a better you"
          icon="flag-outline"
          tint={colors.primary}
          onPress={() => router.push('/goals')}
        />
        <FeatureTile
          testID="tile-progress"
          title="My Progress"
          subtitle="Track your mood & wellness journey"
          icon="bar-chart-outline"
          tint={colors.accentYellow}
          onPress={() => router.push('/progress')}
        />
      </View>

      <EmergencyBanner />

      <Card tone="soft">
        <View style={styles.tip}>
          <Ionicons name="chatbox-ellipses-outline" size={24} color={colors.primary} />
          <View style={styles.tipText}>
            <AppText variant="label" color={colors.primary}>
              Daily Tip
            </AppText>
            <AppText>{tipForDate()}</AppText>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { gap: spacing.md },
  cta: { alignSelf: 'flex-start' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  tip: { flexDirection: 'row', gap: spacing.md },
  tipText: { flex: 1, gap: spacing.xs },
});
