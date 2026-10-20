import ChevronRight from 'lucide-react-native/icons/chevron-right';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, fonts, radius, shadow, spacing } from '@/theme';

import { AppText } from './ui';

type Props = {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  tint: string;
  onPress: () => void;
  testID?: string;
  badge?: string;
};

/** Home feature card (white rounded card, tinted icon circle, chevron). */
export function FeatureTile({ title, subtitle, Icon, tint, onPress, testID, badge }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}${badge ? `. ${badge}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, shadow.card, pressed && { transform: [{ scale: 0.96 }] }]}
    >
      <View style={styles.iconWrap}>
        <Icon size={24} color={tint} />
      </View>
      <AppText variant="label" align="center" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="micro" color={colors.textMuted} align="center" numberOfLines={3} style={styles.sub}>
        {subtitle}
      </AppText>
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="micro" color={colors.primary}>
            {badge}
          </AppText>
        </View>
      ) : (
        <ChevronRight size={14} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '31.5%',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  title: { fontFamily: fonts.bold },
  sub: { fontFamily: fonts.regular },
  badge: { backgroundColor: colors.tealLight, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
});
