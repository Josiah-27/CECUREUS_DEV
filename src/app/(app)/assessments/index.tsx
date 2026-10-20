import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ClipboardList from 'lucide-react-native/icons/clipboard-list';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { useApi } from '@/providers/api-provider';
import { colors, spacing } from '@/theme';

export default function AssessmentsScreen() {
  const api = useApi();
  const query = useQuery(() => api.assessments.list(), []);

  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;

  return (
    <Screen edges={['bottom']} onRefresh={query.reload}>
      <AppText color={colors.textMuted}>
        Short, private check-ins to help you understand your well-being. These are not a medical diagnosis.
      </AppText>
      {query.data.length === 0 ? (
        <EmptyState title="No assessments available" message="Please check back later." Icon={ClipboardList} />
      ) : (
        query.data.map((a) => (
          <Card
            key={a.id}
            testID={`assessment-${a.id}`}
            accessibilityLabel={a.title}
            onPress={() => router.push({ pathname: '/assessments/[id]', params: { id: a.id } })}
          >
            <View style={styles.row}>
              <ClipboardList size={26} color={colors.teal} />
              <View style={styles.flex}>
                <AppText variant="subheading">{a.title}</AppText>
                {a.description ? <AppText color={colors.textMuted}>{a.description}</AppText> : null}
                <AppText variant="caption" color={colors.textMuted}>
                  {[a.estimatedMinutes ? `${a.estimatedMinutes} mins` : null, a.questionCount ? `${a.questionCount} questions` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
});
