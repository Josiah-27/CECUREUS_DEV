import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Counsellor } from '@/api/schemas';
import { resolveMediaUrl } from '@/lib/media';
import { colors, spacing } from '@/theme';

import { AppText, Avatar, Button, Card, Chip } from './ui';

export function counsellorMeta(c: Counsellor): string {
  return [c.title, c.experienceYears ? `${c.experienceYears}+ Years Experience` : null].filter(Boolean).join(' · ');
}

export function CounsellorCard({ counsellor }: { counsellor: Counsellor }) {
  const c = counsellor;
  return (
    <Card testID={`counsellor-${c.id}`}>
      <View style={styles.top}>
        <Avatar name={c.name} uri={resolveMediaUrl(c.imageUrl)} size={64} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <AppText variant="subheading" style={styles.flex}>
              {c.name}
            </AppText>
            <Ionicons name="checkmark-circle" size={18} color={colors.brandBlue} accessibilityLabel="Verified" />
          </View>
          {counsellorMeta(c) ? (
            <AppText variant="caption" color={colors.textMuted}>
              {counsellorMeta(c)}
            </AppText>
          ) : null}
          {c.rating ? (
            <AppText variant="caption">
              ★ {c.rating.toFixed(1)}
              {c.sessionsCount ? ` (${c.sessionsCount} sessions)` : ''}
            </AppText>
          ) : null}
          {c.languages.length ? (
            <AppText variant="caption" color={colors.textMuted}>
              Languages: {c.languages.join(', ')}
            </AppText>
          ) : null}
        </View>
      </View>
      {c.expertise.length ? (
        <View style={styles.chips}>
          {c.expertise.slice(0, 4).map((e) => (
            <Chip key={e} label={e} />
          ))}
          {c.expertise.length > 4 ? <Chip label={`+${c.expertise.length - 4}`} /> : null}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          compact
          variant="outline"
          label="View Profile"
          style={styles.flex}
          onPress={() => router.push({ pathname: '/counsellor/[id]', params: { id: c.id } })}
        />
        <Button
          compact
          label="Book Session"
          testID={`book-${c.id}`}
          style={styles.flex}
          onPress={() => router.push({ pathname: '/book/[id]', params: { id: c.id } })}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', gap: spacing.md },
  info: { flex: 1, gap: spacing.xxs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
