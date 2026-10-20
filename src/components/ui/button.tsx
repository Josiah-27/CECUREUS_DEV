import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET } from '@/theme';

import { AppText } from './app-text';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'emergency';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

const palette: Record<Variant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary, border: colors.primary, pressed: colors.primaryPressed },
  secondary: { bg: colors.primarySoft, fg: colors.primary, border: colors.primarySoft, pressed: '#D3ECEC' },
  outline: { bg: colors.background, fg: colors.primary, border: colors.primary, pressed: colors.primarySoft },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent', pressed: colors.primarySoft },
  danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger, pressed: '#912018' },
  emergency: { bg: colors.emergency, fg: '#FFFFFF', border: colors.emergency, pressed: '#9A3412' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  accessibilityHint,
  testID,
  style,
  compact,
}: Props) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border, opacity: inactive ? 0.55 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText variant="bodyStrong" color={p.fg}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: 40, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
