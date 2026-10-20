import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Chip, LoadingState, Screen } from '@/components/ui';
import { useLocalCollection } from '@/hooks/use-local';
import { useQuery } from '@/hooks/use-query';
import { activityStore, assessmentLogStore, moodStore } from '@/local/stores';
import { addDays } from '@/lib/date';
import { countSince, moodTrend } from '@/lib/progress';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

const CHART_HEIGHT = 120;

export default function ProgressScreen() {
  const api = useApi();
  const [range, setRange] = useState<7 | 30>(7);
  const moods = useLocalCollection(() => moodStore.all());
  const activities = useLocalCollection(() => activityStore.all());
  const assessments = useLocalCollection(() => assessmentLogStore.all());
  const bookings = useQuery(() => api.bookings.list(), []);

  if (moods.loading) return <LoadingState />;
  const trend = moodTrend(moods.items, range);
  const weekAgo = addDays(new Date(), -7);
  const sessionsThisWeek = bookings.data
    ? bookings.data.items.filter((b) => b.status === 'completed' && Date.parse(b.start) >= weekAgo.getTime()).length
    : null;

  return (
    <Screen edges={['bottom']}>
      <View style={styles.headRow}>
        <AppText variant="heading" style={styles.flex}>
          Mood Trend
        </AppText>
        <Chip label="7 days" selected={range === 7} onPress={() => setRange(7)} />
        <Chip label="30 days" selected={range === 30} onPress={() => setRange(30)} />
      </View>

      <Card>
        {trend.every((d) => d.score === null) ? (
          <AppText color={colors.textMuted}>Check in with your mood on the Home screen to see your trend here.</AppText>
        ) : (
          <View
            style={styles.chart}
            accessible
            accessibilityLabel={`Mood trend for the last ${range} days`}
          >
            {trend.map((d) => (
              <View key={d.ymd} style={styles.barCol}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: d.score ? (d.score / 5) * CHART_HEIGHT : 3,
                      backgroundColor: d.score ? (d.score >= 4 ? colors.primary : colors.brandOrange) : colors.border,
                    },
                  ]}
                />
                {range === 7 ? (
                  <AppText variant="caption" color={colors.textMuted}>
                    {d.label}
                  </AppText>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Card>

      <AppText variant="heading">This Week Overview</AppText>
      <Card>
        <Stat label="Sessions taken" value={sessionsThisWeek === null ? '—' : String(sessionsThisWeek)} />
        <Stat label="Exercises completed" value={String(countSince(activities.items, (a) => a.completedAt, weekAgo))} />
        <Stat label="Assessments done" value={String(countSince(assessments.items, (a) => a.completedAt, weekAgo))} />
        <Stat label="Mood check-ins" value={String(countSince(moods.items, (m) => m.at, weekAgo))} />
      </Card>

      {assessments.items.length ? (
        <>
          <AppText variant="heading">Assessment history</AppText>
          {assessments.items.slice(0, 5).map((a) => (
            <Card key={`${a.assessmentId}-${a.completedAt}`}>
              <AppText variant="bodyStrong">{a.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {new Date(a.completedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })} · {Math.round(a.percentage)}% ·{' '}
                {a.level}
              </AppText>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <AppText style={styles.flex}>{label}</AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  chart: { height: CHART_HEIGHT + 24, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  bar: { width: '70%', borderRadius: radius.sm },
  stat: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
});
