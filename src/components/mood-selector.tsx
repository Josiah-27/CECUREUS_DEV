import { Pressable, StyleSheet, View } from 'react-native';

import { MOODS, type Mood } from '@/local/stores';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './ui';

export function MoodSelector({ value, onChange }: { value: Mood | null; onChange: (mood: Mood) => void }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="How are you feeling today?">
      {MOODS.map((m) => {
        const selected = value === m.id;
        return (
          <Pressable
            key={m.id}
            testID={`mood-${m.id}`}
            accessibilityRole="radio"
            accessibilityLabel={m.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(m.id)}
            style={[styles.item, selected && styles.selected]}
          >
            <AppText style={styles.emoji} importantForAccessibility="no">
              {m.emoji}
            </AppText>
            <AppText variant="caption" color={selected ? colors.primary : colors.textMuted}>
              {m.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  item: {
    flexGrow: 1,
    flexBasis: 58,
    minHeight: 64,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  emoji: { fontSize: 24, lineHeight: 30 },
});
