import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { EmergencyBanner } from '@/components/emergency-banner';
import { Logo } from '@/components/logo';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { getEnv } from '@/config/env';
import { colors, spacing } from '@/theme';

export default function WelcomeScreen() {
  const { sessionExpired } = useAuth();
  const env = getEnv();

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.hero}>
        <Logo height={150} />
        <AppText variant="subheading" align="center">
          Your Mental Health Matters
        </AppText>
      </View>

      {sessionExpired ? (
        <Card tone="soft" testID="session-expired">
          <AppText>Your session has expired. Please sign in again.</AppText>
        </Card>
      ) : null}

      <View style={styles.choices}>
        <AppText variant="heading" align="center">
          How would you like to continue?
        </AppText>
        <Button
          testID="choose-corporate"
          label="I am a Corporate Employee"
          icon={<Ionicons name="business-outline" size={20} color="#FFFFFF" />}
          onPress={() => router.push({ pathname: '/login', params: { userType: 'corporate' } })}
          accessibilityHint="Sign in with your work email"
        />
        <Button
          testID="choose-individual"
          label="I am an Individual"
          variant="outline"
          icon={<Ionicons name="person-outline" size={20} color={colors.primary} />}
          onPress={() => router.push({ pathname: '/login', params: { userType: 'individual' } })}
          accessibilityHint="Sign in with your personal email"
        />
      </View>

      <AppText variant="caption" color={colors.textMuted} align="center">
        By continuing you agree to our{' '}
        <AppText
          variant="caption"
          color={colors.primary}
          accessibilityRole="link"
          onPress={() => void WebBrowser.openBrowserAsync(env.termsUrl)}
        >
          Terms
        </AppText>{' '}
        and{' '}
        <AppText
          variant="caption"
          color={colors.primary}
          accessibilityRole="link"
          onPress={() => void WebBrowser.openBrowserAsync(env.privacyPolicyUrl)}
        >
          Privacy Policy
        </AppText>
        . Your conversations and personal information are confidential.
      </AppText>

      <EmergencyBanner />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  choices: { gap: spacing.md },
});
