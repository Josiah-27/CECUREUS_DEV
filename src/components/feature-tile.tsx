import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './ui';

type Props = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
  testID?: string;
  badge?: string;
};

export function FeatureTile({ title, subtitle, icon, tint, onPress, testID, badge }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}${badge ? `. ${badge}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.surface }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tint}1A` }]}>
        <Ionicons name={icon} size={26} color={tint} />
      </View>
      <AppText variant="bodyStrong" align="center">
        {title}
      </AppText>
      <AppText variant="caption" color={colors.textMuted} align="center" numberOfLines={2}>
        {subtitle}
      </AppText>
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="caption" color={colors.primary}>
            {badge}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
  },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
});
