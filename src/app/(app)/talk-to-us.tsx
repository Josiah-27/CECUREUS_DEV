import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import { HELPLINE_DISPLAY, WHATSAPP_DISPLAY } from '@/config/constants';
import { confirmAndCallHelpline, openWhatsApp } from '@/lib/contact';
import { colors, spacing } from '@/theme';

export default function TalkToUsScreen() {
  return (
    <Screen edges={['bottom']} contentStyle={styles.content}>
      <View style={styles.hero}>
        <Ionicons name="heart-circle" size={88} color={colors.primary} />
        <AppText variant="title" align="center">
          We are here for you.{'\n'}You are not alone.
        </AppText>
      </View>

      <View style={styles.block}>
        <AppText variant="display" align="center" color={colors.emergency}>
          {HELPLINE_DISPLAY}
        </AppText>
        <AppText align="center" color={colors.textMuted}>
          Available 24/7 · Confidential · Free
        </AppText>
        <Button
          testID="call-now"
          variant="emergency"
          label="Call Now"
          icon={<Ionicons name="call" size={20} color="#FFFFFF" />}
          onPress={confirmAndCallHelpline}
        />
      </View>

      <View style={styles.block}>
        <Button
          testID="whatsapp"
          variant="outline"
          label={`WhatsApp ${WHATSAPP_DISPLAY}`}
          icon={<Ionicons name="logo-whatsapp" size={20} color={colors.primary} />}
          onPress={() => void openWhatsApp()}
        />
        <Button variant="secondary" label="Book a Counsellor" onPress={() => router.push('/counsellors')} />
      </View>

      <AppText variant="caption" align="center" color={colors.textMuted}>
        If you are in immediate danger, call 112 (India emergency services).
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: spacing.md },
  block: { gap: spacing.md },
});
