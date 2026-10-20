import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Circle from 'lucide-react-native/icons/circle';
import RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import Trash2 from 'lucide-react-native/icons/trash';
import Trophy from 'lucide-react-native/icons/trophy';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Chip, LoadingState, Screen, TextField } from '@/components/ui';
import { useLocalCollection } from '@/hooks/use-local';
import { goalStore } from '@/local/stores';
import { toYmd } from '@/lib/date';
import { currentStreak } from '@/lib/streak';
import { colors, spacing } from '@/theme';

const SUGGESTIONS = ['Sleep before 11 PM', 'Daily meditation (10 min)', 'Drink 8 glasses of water', 'Walk for 20 minutes'];

export default function GoalsScreen() {
  const goals = useLocalCollection(() => goalStore.all());
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [title, setTitle] = useState('');
  const today = toYmd(new Date());

  async function add(value: string) {
    if (!value.trim()) return;
    goals.setItems(await goalStore.add(value));
    setTitle('');
  }

  async function toggle(id: string, wasDone: boolean) {
    const next = await goalStore.toggleDay(id, today);
    goals.setItems(next);
    if (!wasDone) {
      const goal = next.find((g) => g.id === id);
      const streak = goal ? currentStreak(goal.completions) : 0;
      if (streak > 1) Alert.alert('Great job! 🎉', `You're on a ${streak}-day streak. Keep it up!`);
    }
  }

  const list = goals.items.filter((g) => (tab === 'active' ? !g.archived : g.archived));

  return (
    <Screen edges={['bottom']}>
      <View style={styles.tabs}>
        <Chip label="Active" selected={tab === 'active'} onPress={() => setTab('active')} />
        <Chip label="Completed" selected={tab === 'completed'} onPress={() => setTab('completed')} />
      </View>

      {tab === 'active' ? (
        <View style={styles.section}>
          <TextField
            testID="goal-input"
            label="Set a small goal"
            placeholder="e.g. Exercise 3x a week"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            returnKeyType="done"
            onSubmitEditing={() => void add(title)}
          />
          <Button testID="add-goal" label="Add goal" onPress={() => void add(title)} disabled={!title.trim()} />
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={`+ ${s}`} onPress={() => void add(s)} />
            ))}
          </View>
        </View>
      ) : null}

      {goals.loading ? (
        <LoadingState />
      ) : list.length === 0 ? (
        <AppText color={colors.textMuted}>{tab === 'active' ? 'No active goals yet.' : 'No completed goals yet.'}</AppText>
      ) : (
        list.map((g) => {
          const doneToday = g.completions.includes(today);
          const streak = currentStreak(g.completions);
          return (
            <Card key={g.id} testID={`goal-${g.id}`}>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: doneToday }}
                  accessibilityLabel={`Mark ${g.title} done for today`}
                  onPress={() => void toggle(g.id, doneToday)}
                  hitSlop={8}
                  disabled={g.archived}
                >
                  {doneToday ? (
                    <CheckCircle2 size={28} color={colors.teal} />
                  ) : (
                    <Circle size={28} color={colors.textMuted} />
                  )}
                </Pressable>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{g.title}</AppText>
                  <AppText variant="caption" color={streak ? colors.success : colors.textMuted}>
                    {streak ? `${streak} day streak` : 'Start your streak today'}
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={g.archived ? `Restore ${g.title}` : `Mark ${g.title} as achieved`}
                  hitSlop={8}
                  onPress={async () => goals.setItems(await goalStore.setArchived(g.id, !g.archived))}
                >
                  {g.archived ? <RotateCcw size={20} color={colors.teal} /> : <Trophy size={20} color={colors.amber} />}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${g.title}`}
                  hitSlop={8}
                  onPress={() =>
                    Alert.alert('Delete goal?', g.title, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: async () => goals.setItems(await goalStore.remove(g.id)) },
                    ])
                  }
                >
                  <Trash2 size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm },
  section: { gap: spacing.md },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
