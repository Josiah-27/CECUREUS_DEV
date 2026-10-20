import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { BrandName, LogoMark } from '@/components/brand';
import { EmergencyBanner } from '@/components/emergency-banner';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { colors, spacing } from '@/theme';

const SLIDES = [
  'Your Mental Health Matters',
  'Talk confidentially to certified counsellors',
  'Breathe, reflect and grow — at your pace',
];

/** Splash / welcome screen from the design. */
export default function WelcomeScreen() {
  const { sessionExpired } = useAuth();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <Screen
      edges={['top', 'bottom']}
      contentStyle={styles.content}
      footer={<EmergencyBanner compact />}
    >
      <View style={styles.hero}>
        <LogoMark size={96} />
        <BrandName size={36} />
        <AppText variant="subheading" color={colors.textMuted} align="center" accessibilityLiveRegion="polite">
          {SLIDES[slide]}
        </AppText>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={`Show message ${i + 1} of ${SLIDES.length}`}
            accessibilityState={{ selected: slide === i }}
            hitSlop={8}
            onPress={() => setSlide(i)}
            style={[styles.dot, slide === i && styles.dotActive]}
          />
        ))}
      </View>

      {sessionExpired ? (
        <Card tone="soft" testID="session-expired">
          <AppText>Your session has expired. Please sign in again.</AppText>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button testID="get-started" label="Get Started" onPress={() => router.push('/choose')} />
        <Button
          testID="have-account"
          variant="ghost"
          label="I already have an account"
          onPress={() => router.push('/sign-in')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', backgroundColor: colors.background },
  hero: { alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B2EAEA' },
  dotActive: { width: 24, backgroundColor: colors.teal },
  actions: { gap: spacing.sm },
});
