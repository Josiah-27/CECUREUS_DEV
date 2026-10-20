import HeartHandshake from 'lucide-react-native/icons/heart-handshake';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Phone from 'lucide-react-native/icons/phone';
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
        <View style={styles.heroIcon}>
          <HeartHandshake size={44} color={colors.teal} />
        </View>
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
          icon={<Phone size={18} color="#FFFFFF" />}
          onPress={confirmAndCallHelpline}
        />
      </View>

      <View style={styles.block}>
        <Button
          testID="whatsapp"
          variant="outline"
          label={`WhatsApp ${WHATSAPP_DISPLAY}`}
          icon={<MessageCircle size={18} color={colors.primary} />}
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
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: { gap: spacing.md },
});
