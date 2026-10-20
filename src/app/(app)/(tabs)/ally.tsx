import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmergencyBanner } from '@/components/emergency-banner';
import { Logo } from '@/components/logo';
import { AppText, Button, Card, Screen, SectionHeader } from '@/components/ui';
import { BREATHING_EXERCISES } from '@/lib/breathing';
import { confirmAndCallHelpline, openWhatsApp } from '@/lib/contact';
import { colors, radius, spacing } from '@/theme';

/** The AI companion is Phase 2. Phase 1 offers human support routes and quick activities. */
export default function AllyScreen() {
  return (
    <Screen testID="ally-screen">
      <View style={styles.hero}>
        <Logo variant="mark" height={56} />
        <View style={styles.flex}>
          <AppText variant="display">Hi, I&apos;m Ally 👋</AppText>
          <AppText color={colors.textMuted}>Your mental wellness companion.</AppText>
        </View>
      </View>

      <Card tone="soft" testID="ally-coming-soon">
        <AppText variant="subheading">Ally chat is coming soon</AppText>
        <AppText color={colors.textMuted}>
          We&apos;re building Ally carefully so it is safe and genuinely helpful. Until then, real people are here for you
          24/7.
        </AppText>
      </Card>

      <View style={styles.section}>
        <AppText variant="heading">Talk to someone now</AppText>
        <Button
          variant="emergency"
          label="Call 1800 121 9497"
          icon={<Ionicons name="call" size={20} color="#FFFFFF" />}
          onPress={confirmAndCallHelpline}
        />
        <Button
          variant="outline"
          label="Chat with us on WhatsApp"
          icon={<Ionicons name="logo-whatsapp" size={20} color={colors.primary} />}
          onPress={() => void openWhatsApp()}
        />
        <Button variant="secondary" label="Book a Counsellor" onPress={() => router.push('/counsellors')} />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Quick Activities" onAction={() => router.push('/breathing')} />
        <View style={styles.activities}>
          {BREATHING_EXERCISES.slice(0, 4).map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={e.title}
              onPress={() => router.push({ pathname: '/breathing/[id]', params: { id: e.id } })}
              style={styles.activity}
            >
              <Ionicons name={e.icon} size={28} color={colors.primary} />
              <AppText variant="label" align="center">
                {e.title}
              </AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {Math.round(e.totalSeconds / 60)} mins
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1 },
  section: { gap: spacing.md },
  activities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  activity: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
