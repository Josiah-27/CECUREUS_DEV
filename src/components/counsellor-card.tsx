import { router } from 'expo-router';
import BadgeCheck from 'lucide-react-native/icons/badge-check';
import Star from 'lucide-react-native/icons/star';
import { StyleSheet, View } from 'react-native';

import type { Counsellor } from '@/api/schemas';
import { resolveMediaUrl } from '@/lib/media';
import { colors, fonts, spacing } from '@/theme';

import { AppText, Avatar, Button, Card, Chip } from './ui';

export function counsellorMeta(c: Counsellor): string {
  return [c.title, c.experienceYears ? `${c.experienceYears}+ Years Experience` : null].filter(Boolean).join(' · ');
}

export function CounsellorCard({ counsellor }: { counsellor: Counsellor }) {
  const c = counsellor;
  return (
    <Card testID={`counsellor-${c.id}`}>
      <View style={styles.row}>
        <Avatar name={c.name} uri={resolveMediaUrl(c.imageUrl)} size={56} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <AppText variant="label" style={styles.name} numberOfLines={2}>
              {c.name}
            </AppText>
            <BadgeCheck size={14} color={colors.teal} accessibilityLabel="Verified" />
          </View>
          {c.title ? (
            <AppText variant="micro" color={colors.textMuted}>
              {c.title}
            </AppText>
          ) : null}
          {c.experienceYears ? (
            <AppText variant="micro" color={colors.textMuted}>
              {c.experienceYears}+ Years Experience
            </AppText>
          ) : null}
          {c.rating ? (
            <View style={styles.rating}>
              <Star size={11} color={colors.star} fill={colors.star} />
              <AppText variant="micro">{c.rating.toFixed(1)}</AppText>
              {c.sessionsCount ? (
                <AppText variant="micro" color={colors.textMuted}>
                  ({c.sessionsCount} sessions)
                </AppText>
              ) : null}
            </View>
          ) : null}
          {c.expertise.length ? (
            <View style={styles.tags}>
              {c.expertise.slice(0, 4).map((e) => (
                <Chip key={e} label={e} kind="tag" />
              ))}
              {c.expertise.length > 4 ? <Chip label={`+${c.expertise.length - 4}`} kind="tag" /> : null}
            </View>
          ) : null}
          {c.languages.length ? (
            <AppText variant="micro" color={colors.textMuted}>
              🌐 {c.languages.join(', ')}
            </AppText>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Button
            compact
            variant="outline"
            label="View Profile"
            onPress={() => router.push({ pathname: '/counsellor/[id]', params: { id: c.id } })}
          />
          <Button
            compact
            label="Book Session"
            testID={`book-${c.id}`}
            onPress={() => router.push({ pathname: '/book/[id]', params: { id: c.id } })}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { fontFamily: fonts.bold, flexShrink: 1 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.xs },
  actions: { gap: spacing.xs + 2 },
});
