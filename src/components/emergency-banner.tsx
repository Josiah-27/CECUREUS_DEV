import Phone from 'lucide-react-native/icons/phone';
import { Pressable, StyleSheet, View } from 'react-native';

import { HELPLINE_DISPLAY } from '@/config/constants';
import { confirmAndCallHelpline } from '@/lib/contact';
import { colors, radius, spacing } from '@/theme';

import { AppText, Button } from './ui';

/** Always-visible emergency helpline banner (red tint, as in the design). */
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
      <View style={[styles.icon, compact && styles.iconCompact]}>
        <Phone size={compact ? 14 : 16} color={colors.emergencyIcon} />
      </View>
      <View style={styles.flex}>
        <AppText variant={compact ? 'caption' : 'label'} color={compact ? colors.textMuted : colors.text}>
          If anyone touches you or makes you uncomfortable, get help immediately.
        </AppText>
        {!compact ? (
          <>
            <AppText variant="heading" color={colors.emergency}>
              {HELPLINE_DISPLAY}
            </AppText>
            <AppText variant="micro" color={colors.textMuted}>
              Available 24/7 · Confidential · Free
            </AppText>
          </>
        ) : null}
      </View>
      {compact ? (
        <View style={styles.compactNumber}>
          <AppText variant="bodyStrong" color={colors.emergency}>
            {HELPLINE_DISPLAY}
          </AppText>
          <AppText variant="micro" color={colors.textMuted} align="right">
            24/7 · Free
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Teal "talk to someone" strip used at the bottom of Home, Explore and Counsellor.
 * `pill` shows the number in an amber pill (Home); `button` shows a teal call button.
 */
export function SupportCallCard({
  title,
  subtitle = 'Our counsellors are here to listen and support you.',
  variant = 'button',
}: {
  title: string;
  subtitle?: string;
  variant?: 'pill' | 'button';
}) {
  return (
    <View style={styles.support} testID="support-call-card">
      <View style={styles.supportIcon}>
        <Phone size={16} color="#FFFFFF" />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {subtitle}
        </AppText>
        {variant === 'pill' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${HELPLINE_DISPLAY}`}
            onPress={confirmAndCallHelpline}
            style={styles.pill}
          >
            <Phone size={14} color={colors.amber} />
            <AppText variant="bodyStrong" color="#B45309">
              {HELPLINE_DISPLAY}
            </AppText>
          </Pressable>
        ) : (
          <Button
            compact
            label={HELPLINE_DISPLAY}
            icon={<Phone size={13} color="#FFFFFF" />}
            onPress={confirmAndCallHelpline}
            style={styles.supportButton}
          />
        )}
        <AppText variant="micro" color={colors.textMuted}>
          Available 24/7 · Confidential · Free
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.emergencySoft,
  },
  compact: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.emergencyIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCompact: { width: 32, height: 32, borderRadius: 16 },
  compactNumber: { alignItems: 'flex-end' },
  flex: { flex: 1, gap: 2 },
  support: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.tealLight,
  },
  supportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  supportButton: { alignSelf: 'flex-start', marginVertical: spacing.xs },
});
