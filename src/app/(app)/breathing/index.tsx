import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Screen } from '@/components/ui';
import { BREATHING_EXERCISES } from '@/lib/breathing';
import { colors, spacing } from '@/theme';

export default function BreathingListScreen() {
  return (
    <Screen edges={['bottom']}>
      <AppText color={colors.textMuted}>Choose an exercise. Find a comfortable position and follow the circle.</AppText>
      {BREATHING_EXERCISES.map((e) => (
        <Card
          key={e.id}
          testID={`exercise-${e.id}`}
          accessibilityLabel={`${e.title}. ${e.subtitle}. ${Math.round(e.totalSeconds / 60)} minutes`}
          onPress={() => router.push({ pathname: '/breathing/[id]', params: { id: e.id } })}
        >
          <View style={styles.row}>
            <View style={styles.icon}>
              <AppText style={styles.emoji} aria-hidden>
                {e.emoji}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="subheading">{e.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {e.subtitle} · {Math.round(e.totalSeconds / 60)} min
              </AppText>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  emoji: { fontSize: 22, lineHeight: 28 },
});
