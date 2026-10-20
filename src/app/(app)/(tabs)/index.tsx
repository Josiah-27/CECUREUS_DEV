import { router } from 'expo-router';
import BarChart2 from 'lucide-react-native/icons/chart-no-axes-column';
import BookOpen from 'lucide-react-native/icons/book-open';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Shield from 'lucide-react-native/icons/shield';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Target from 'lucide-react-native/icons/target';
import Wind from 'lucide-react-native/icons/wind';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { SupportCallCard } from '@/components/emergency-banner';
import { FeatureTile } from '@/components/feature-tile';
import { HomeHeroIllustration } from '@/components/illustrations';
import { MoodSelector } from '@/components/mood-selector';
import { TopNav } from '@/components/top-nav';
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
    <Screen testID="home-screen" header={<TopNav />}>
      <View style={styles.greetingRow}>
        <View style={styles.flex}>
          <AppText variant="display">Hi, {user?.firstName ?? 'there'} 👋</AppText>
          <AppText color={colors.textMuted}>How are you feeling today?</AppText>
        </View>
        <HomeHeroIllustration size={96} />
      </View>

      <View style={styles.moodBlock}>
        <MoodSelector value={mood} onChange={selectMood} />
        {mood && mood !== 'good' ? (
          <AppText variant="caption" color={colors.primary} testID="mood-support">
            Thanks for sharing. A short breathing exercise or a chat with a counsellor may help.
          </AppText>
        ) : null}
        <Button
          label="Start Your Wellness Journey"
          trailingIcon={<ChevronRight size={16} color="#FFFFFF" />}
          onPress={() => router.push('/assessments')}
          accessibilityHint="Opens self assessments"
          style={styles.cta}
        />
      </View>

      {user?.userType === 'corporate' && user.companyName ? (
        <Card tone="soft">
          <View style={styles.coveredRow}>
            <Shield size={20} color={colors.teal} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">Covered by {user.companyName}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                Your counselling sessions are included in your organisation&apos;s wellness program
                {typeof user.sessionsRemaining === 'number' ? ` · ${user.sessionsRemaining} sessions remaining` : ''}.
              </AppText>
            </View>
          </View>
        </Card>
      ) : null}

      <View style={styles.grid}>
        <FeatureTile
          testID="tile-counsellor"
          title="Talk to a Counsellor"
          subtitle="Connect with our certified counsellors"
          Icon={MessageCircle}
          tint={colors.teal}
          onPress={() => router.push('/counsellors')}
        />
        <FeatureTile
          testID="tile-ally"
          title="AI Ally"
          subtitle="Chat with Ally for instant support"
          Icon={Sparkles}
          tint={colors.amber}
          badge="Coming soon"
          onPress={() => router.push('/ally')}
        />
        <FeatureTile
          testID="tile-breathing"
          title="Breathing Exercises"
          subtitle="Relax your mind with guided breathing"
          Icon={Wind}
          tint={colors.teal}
          onPress={() => router.push('/breathing')}
        />
        <FeatureTile
          testID="tile-journal"
          title="Journal"
          subtitle="Express your thoughts and feelings"
          Icon={BookOpen}
          tint={colors.amber}
          onPress={() => router.push('/journal')}
        />
        <FeatureTile
          testID="tile-goals"
          title="My Goals"
          subtitle="Set small goals for a better you"
          Icon={Target}
          tint={colors.teal}
          onPress={() => router.push('/goals')}
        />
        <FeatureTile
          testID="tile-progress"
          title="My Progress"
          subtitle="Track your mood & wellness journey"
          Icon={BarChart2}
          tint={colors.amber}
          onPress={() => router.push('/progress')}
        />
      </View>

      <SupportCallCard title="Need to talk to someone?" variant="pill" />

      <Card>
        <View style={styles.tip}>
          <View style={styles.quote}>
            <AppText variant="title" color="#FFFFFF">
              “
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="label" color={colors.primary}>
              Daily Tip
            </AppText>
            <AppText variant="caption">{tipForDate()}</AppText>
          </View>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moodBlock: { gap: spacing.md, marginTop: -spacing.md },
  cta: { alignSelf: 'flex-start' },
  coveredRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  tip: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  quote: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
