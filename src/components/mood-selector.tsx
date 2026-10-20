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
            <AppText variant="micro" color={selected ? colors.primary : colors.textMuted}>
              {m.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs + 2, flexWrap: 'wrap' },
  item: {
    minWidth: 58,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  selected: { borderColor: colors.teal, backgroundColor: colors.tealLight },
  emoji: { fontSize: 18, lineHeight: 24 },
});
