import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { friendlyMessage } from '@/api/errors';
import type { AssessmentResult } from '@/api/schemas';
import { AppText, Button, Card, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { assessmentLogStore } from '@/local/stores';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

export default function AssessmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const query = useQuery(() => api.assessments.get(String(id)), [id]);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;
  const a = query.data;
  const q = a.questions[index];
  const isLast = index === a.questions.length - 1;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.assessments.submit(
        a.id,
        a.questions.map((question) => ({ questionId: question.id, optionId: answers[question.id] })),
      );
      setResult(res);
      void assessmentLogStore.log({
        assessmentId: a.id,
        title: a.title,
        completedAt: new Date().toISOString(),
        percentage: res.percentage,
        level: res.level,
      });
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Screen edges={['bottom']}>
        <View style={styles.center}>
          <AppText variant="label" color={colors.textMuted}>
            {a.title}
          </AppText>
          <AppText variant="display" testID="assessment-score">
            {Math.round(result.percentage)}%
          </AppText>
          <AppText variant="title" color={colors.primary}>
            {result.level}
          </AppText>
        </View>
        {result.summary ? <AppText>{result.summary}</AppText> : null}
        <Card tone="soft">
          <AppText variant="caption">
            This is a self-check, not a diagnosis. If you are struggling, talking to a counsellor can help.
          </AppText>
        </Card>
        <Button label="Talk to a Counsellor" onPress={() => router.replace('/counsellors')} />
        <Button variant="outline" label="Try a Breathing Exercise" onPress={() => router.replace('/breathing')} />
      </Screen>
    );
  }

  if (!started) {
    return (
      <Screen edges={['bottom']} footer={<Button testID="start-assessment" label="Start" onPress={() => setStarted(true)} />}>
        <AppText variant="title">{a.title}</AppText>
        {a.description ? <AppText color={colors.textMuted}>{a.description}</AppText> : null}
        <Card tone="soft">
          <AppText>
            {a.questions.length} questions{a.estimatedMinutes ? ` · about ${a.estimatedMinutes} minutes` : ''}. Answer
            honestly — there are no right or wrong answers. Your answers are private and never shared with your employer.
          </AppText>
        </Card>
      </Screen>
    );
  }

  const selected = answers[q.id];
  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.nav}>
          {error ? <AppText color={colors.danger}>{error}</AppText> : null}
          <View style={styles.navRow}>
            <Button
              variant="outline"
              label="Back"
              style={styles.flex}
              disabled={index === 0}
              onPress={() => setIndex((i) => Math.max(0, i - 1))}
            />
            <Button
              testID={isLast ? 'submit-assessment' : 'next-question'}
              label={isLast ? 'See results' : 'Next'}
              style={styles.flex}
              disabled={!selected}
              loading={submitting}
              onPress={() => (isLast ? void submit() : setIndex((i) => i + 1))}
            />
          </View>
        </View>
      }
    >
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: a.questions.length, now: index + 1 }}>
        <View style={[styles.progressFill, { width: `${((index + 1) / a.questions.length) * 100}%` }]} />
      </View>
      <AppText variant="caption" color={colors.textMuted}>
        Question {index + 1} of {a.questions.length}
      </AppText>
      <AppText variant="heading">{q.text}</AppText>
      <View style={styles.options} accessibilityRole="radiogroup">
        {q.options.map((o) => {
          const isSelected = selected === o.id;
          return (
            <Pressable
              key={o.id}
              testID={`option-${o.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={o.text}
              onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: o.id }))}
              style={[styles.option, isSelected && styles.optionSelected]}
            >
              <AppText color={isSelected ? colors.primary : colors.text}>{o.text}</AppText>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.xs },
  nav: { gap: spacing.sm },
  navRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary },
  options: { gap: spacing.sm },
  option: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
