import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { counsellorMeta } from '@/components/counsellor-card';
import { EmergencyBanner } from '@/components/emergency-banner';
import { AppText, Avatar, Button, Card, Chip, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useQuery } from '@/hooks/use-query';
import { confirmAndCallHelpline } from '@/lib/contact';
import { resolveMediaUrl } from '@/lib/media';
import { useApi } from '@/providers/api-provider';
import { colors, spacing } from '@/theme';

const MODE_LABEL = { audio: 'Audio', video: 'Video', chat: 'Chat' } as const;

export default function CounsellorProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const api = useApi();
  const query = useQuery(() => api.counsellors.get(String(id)), [id]);

  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;
  const c = query.data;

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footer}>
          <Button
            variant="outline"
            label="Call Now"
            style={styles.flex}
            onPress={confirmAndCallHelpline}
            accessibilityHint="Calls the CecureUs support line"
          />
          <Button
            testID="profile-book"
            label="Book Session"
            style={styles.flex}
            onPress={() => router.push({ pathname: '/book/[id]', params: { id: c.id } })}
          />
        </View>
      }
    >
      <View style={styles.header}>
        <Avatar name={c.name} uri={resolveMediaUrl(c.imageUrl)} size={96} />
        <AppText variant="title" align="center">
          {c.name}
        </AppText>
        {counsellorMeta(c) ? (
          <AppText color={colors.textMuted} align="center">
            {counsellorMeta(c)}
          </AppText>
        ) : null}
        {c.rating ? (
          <AppText align="center">
            ★ {c.rating.toFixed(1)}
            {c.sessionsCount ? ` · ${c.sessionsCount} sessions` : ''}
          </AppText>
        ) : null}
        {c.city ? (
          <AppText variant="caption" color={colors.textMuted}>
            {c.city}
          </AppText>
        ) : null}
      </View>

      {c.expertise.length ? (
        <Section title="Areas of Expertise">
          <View style={styles.chips}>
            {c.expertise.map((e) => (
              <Chip key={e} label={e} />
            ))}
          </View>
        </Section>
      ) : null}

      {c.about ? (
        <Section title="About">
          <AppText>{c.about}</AppText>
        </Section>
      ) : null}

      <Section title="Session details">
        <Card>
          <Row label="Session types" value={c.modes.map((m) => MODE_LABEL[m]).join(' · ')} />
          {c.languages.length ? <Row label="Languages" value={c.languages.join(', ')} /> : null}
        </Card>
      </Section>

      <EmergencyBanner compact />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="heading">{title}</AppText>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  row: { gap: spacing.xxs, paddingVertical: spacing.xs },
  footer: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
