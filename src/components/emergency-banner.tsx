import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { HELPLINE_DISPLAY } from '@/config/constants';
import { confirmAndCallHelpline } from '@/lib/contact';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './ui';

/** Always-visible emergency helpline banner (required on all critical screens). */
export function EmergencyBanner({ compact = false }: { compact?: boolean }) {
  return (
    <Pressable
      testID="emergency-banner"
      accessibilityRole="button"
      accessibilityLabel={`Emergency helpline ${HELPLINE_DISPLAY}. If anyone touches you or makes you uncomfortable, get help immediately.`}
      accessibilityHint="Asks for confirmation, then opens the phone dialer"
      onPress={confirmAndCallHelpline}
      style={({ pressed }) => [styles.banner, compact && styles.compact, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.icon}>
        <Ionicons name="call" size={compact ? 18 : 22} color="#FFFFFF" />
      </View>
      <View style={styles.text}>
        {!compact ? (
          <AppText variant="caption" color={colors.text}>
            If anyone touches you or makes you uncomfortable, get help immediately.
          </AppText>
        ) : null}
        <AppText variant={compact ? 'bodyStrong' : 'heading'} color={colors.emergency}>
          {HELPLINE_DISPLAY}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Available 24/7 · Confidential · Free
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.emergencySoft,
    borderWidth: 1,
    borderColor: '#FBD5BC',
  },
  compact: { padding: spacing.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.emergency,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
});
