import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing, TOUCH_TARGET } from '@/theme';

import { AppText } from './app-text';
import { GlassSheen, useLiquidPress } from './glass';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const LIGHT: Variant[] = ['secondary', 'outline'];

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'emergency';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

const palette: Record<Variant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary, border: colors.primary, pressed: colors.primaryPressed },
  secondary: { bg: colors.tealLight, fg: colors.primary, border: colors.tealLight, pressed: '#CBEFEF' },
  outline: { bg: colors.background, fg: colors.primary, border: colors.primary, pressed: colors.tealLight },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent', pressed: colors.tealLight },
  danger: { bg: colors.danger, fg: '#FFFFFF', border: colors.danger, pressed: '#912018' },
  emergency: { bg: colors.emergency, fg: '#FFFFFF', border: colors.emergency, pressed: '#991B1B' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  trailingIcon,
  accessibilityHint,
  testID,
  style,
  compact,
}: Props) {
  const p = palette[variant];
  const inactive = disabled || loading;
  const [pressed, setPressed] = useState(false);
  const liquid = useLiquidPress();
  const filled = variant !== 'ghost' && !LIGHT.includes(variant);
  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true);
        liquid.onPressIn();
      }}
      onPressOut={() => {
        setPressed(false);
        liquid.onPressOut();
      }}
      style={[
        styles.base,
        compact && styles.compact,
        filled && !compact && !inactive && [shadow.raised, { shadowColor: p.bg, shadowOpacity: 0.3 }],
        { backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border, opacity: inactive ? 0.55 : 1 },
        style,
        liquid.style,
      ]}
    >
      {variant !== 'ghost' ? <GlassSheen radius={radius.pill} tone={filled ? 'tinted' : 'light'} /> : null}
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText variant={compact ? 'label' : 'bodyStrong'} color={p.fg}>
            {label}
          </AppText>
          {trailingIcon}
        </View>
      )}
    </AnimatedPressable>
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
  compact: { minHeight: 36, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
