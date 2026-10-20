import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './app-text';

type Props = { label: string; selected?: boolean; onPress?: () => void; testID?: string };

export function Chip({ label, selected = false, onPress, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      style={[styles.chip, selected ? styles.selected : styles.idle]}
    >
      <AppText variant="label" color={selected ? colors.textOnPrimary : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.background, borderColor: colors.border },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
