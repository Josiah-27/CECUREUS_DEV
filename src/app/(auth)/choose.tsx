import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import Building2 from 'lucide-react-native/icons/building-complex';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import User from 'lucide-react-native/icons/user';
import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { UserType } from '@/api/schemas';
import { AppText, Card, Screen } from '@/components/ui';
import { getEnv } from '@/config/env';
import { colors, spacing } from '@/theme';

function Choice({
  testID,
  title,
  subtitle,
  Icon,
  tint,
  userType,
}: {
  testID: string;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  tint: string;
  userType: UserType;
}) {
  return (
    <Card
      testID={testID}
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={() => router.push({ pathname: '/register', params: { userType } })}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${tint}22` }]}>
          <Icon size={26} color={tint} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading">{title}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {subtitle}
          </AppText>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </Card>
  );
}

/** Step 1 of the access flow: corporate employee or individual. */
export default function ChooseUserTypeScreen() {
  const env = getEnv();
  return (
    <Screen edges={['bottom']}>
      <View style={styles.header}>
        <AppText variant="display">How would you like to continue?</AppText>
        <AppText color={colors.textMuted}>Choose how you access CecureUs.</AppText>
      </View>

      <Choice
        testID="choose-corporate"
        title="I am a Corporate Employee"
        subtitle="Access through your company's wellness programme. Sessions are covered."
        Icon={Building2}
        tint={colors.teal}
        userType="corporate"
      />
      <Choice
        testID="choose-individual"
        title="I am an Individual"
        subtitle="Create an account with your email and mobile number."
        Icon={User}
        tint={colors.amber}
        userType="individual"
      />

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
});
