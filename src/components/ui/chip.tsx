import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './app-text';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  /** "filter" = filled pill (design filter chips); "tag" = small outlined label. */
  kind?: 'filter' | 'tag';
};

export function Chip({ label, selected = false, onPress, testID, kind = 'filter' }: Props) {
  if (kind === 'tag') {
    return (
      <Pressable testID={testID} accessibilityRole="text" disabled style={styles.tag}>
        <AppText variant="micro" color={colors.textMuted}>
          {label}
        </AppText>
      </Pressable>
    );
  }
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
      <AppText variant="label" color={selected ? colors.textOnPrimary : colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Emoji-over-label category tile used on Explore. */
export function IconChip({
  label,
  icon,
  selected,
  onPress,
  testID,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.iconChip, selected ? styles.iconChipSelected : styles.iconChipIdle]}
    >
      <AppText style={styles.emoji} importantForAccessibility="no">
        {icon}
      </AppText>
      <AppText variant="micro" color={selected ? colors.primary : colors.textMuted}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { backgroundColor: colors.background, borderColor: colors.border },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconChip: {
    minWidth: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  iconChipIdle: { backgroundColor: colors.background, borderColor: colors.border },
  iconChipSelected: { backgroundColor: colors.tealLight, borderColor: colors.teal },
  emoji: { fontSize: 18, lineHeight: 22 },
});
