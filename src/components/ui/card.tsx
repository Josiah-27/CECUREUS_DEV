import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/theme';

type Tone = 'default' | 'soft' | 'amber' | 'emergency';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  tone?: Tone;
};

const toneBg: Record<Tone, string> = {
  default: colors.background,
  soft: colors.tealLight,
  amber: colors.amberLight,
  emergency: colors.emergencySoft,
};

export function Card({ children, onPress, accessibilityLabel, style, testID, tone = 'default' }: Props) {
  const base = [
    styles.card,
    { backgroundColor: toneBg[tone] },
    tone === 'default' && [styles.bordered, shadow.card],
    style,
  ];
  if (!onPress) {
    return (
      <View testID={testID} style={base}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing.lg },
  bordered: { borderWidth: 1, borderColor: colors.borderSubtle },
});
