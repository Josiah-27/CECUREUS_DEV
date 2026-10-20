import Lock from 'lucide-react-native/icons/lock';
import Trash2 from 'lucide-react-native/icons/trash';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { MoodSelector } from '@/components/mood-selector';
import { AppText, Button, Card, Chip, LoadingState, Screen, TextField } from '@/components/ui';
import { useLocalCollection } from '@/hooks/use-local';
import { journalStore, MAX_JOURNAL_LENGTH, MOODS, type Mood } from '@/local/stores';
import { colors, spacing } from '@/theme';

const PROMPTS = ['What stressed you today?', 'What are you grateful for?', 'What made you smile today?'];

export default function JournalScreen() {
  const journal = useLocalCollection(() => journalStore.all());
  const [prompt, setPrompt] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [mood, setMood] = useState<Mood | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      journal.setItems(await journalStore.add({ text, prompt, mood }));
      setText('');
      setPrompt(null);
      setMood(null);
    } catch (e) {
      Alert.alert('Could not save entry', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function remove(id: string) {
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => journal.setItems(await journalStore.remove(id)),
      },
    ]);
  }

  return (
    <Screen edges={['bottom']}>
      <Card tone="soft">
        <View style={styles.row}>
          <Lock size={18} color={colors.teal} />
          <AppText variant="caption" style={styles.flex}>
            Your journal is encrypted and stored only on this device. It is never visible to counsellors, admins or your
            employer.
          </AppText>
        </View>
      </Card>

      <View style={styles.section}>
        <AppText variant="label">Choose a prompt or write freely</AppText>
        <View style={styles.prompts}>
          {PROMPTS.map((p) => (
            <Chip key={p} label={p} selected={prompt === p} onPress={() => setPrompt(prompt === p ? null : p)} />
          ))}
        </View>
        <TextField
          testID="journal-input"
          label={prompt ?? 'Start writing'}
          placeholder="Write your thoughts…"
          multiline
          value={text}
          onChangeText={(t) => setText(t.slice(0, MAX_JOURNAL_LENGTH))}
          hint={`${text.length}/${MAX_JOURNAL_LENGTH}`}
        />
        <AppText variant="label">Tag your mood (optional)</AppText>
        <MoodSelector value={mood} onChange={(m) => setMood(mood === m ? null : m)} />
        <Button testID="save-journal" label="Save Entry" onPress={() => void save()} disabled={!text.trim()} loading={saving} />
      </View>

      <View style={styles.section}>
        <AppText variant="heading">Past entries</AppText>
        {journal.loading ? (
          <LoadingState />
        ) : journal.items.length === 0 ? (
          <AppText color={colors.textMuted}>No entries yet. Your first entry will appear here.</AppText>
        ) : (
          journal.items.map((e) => (
            <Card key={e.id} testID={`journal-${e.id}`}>
              <View style={styles.entryHead}>
                <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
                  {new Date(e.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  {e.mood ? ` · ${MOODS.find((m) => m.id === e.mood)?.emoji ?? ''}` : ''}
                </AppText>
                <Pressable accessibilityRole="button" accessibilityLabel="Delete entry" hitSlop={12} onPress={() => remove(e.id)}>
                  <Trash2 size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              {e.prompt ? <AppText variant="label">{e.prompt}</AppText> : null}
              <AppText>{e.text}</AppText>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  section: { gap: spacing.md },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  entryHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
});
