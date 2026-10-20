import CalendarDays from 'lucide-react-native/icons/calendar-days';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Modal, ScrollView, StyleSheet, View } from 'react-native';

import { friendlyMessage } from '@/api/errors';
import type { Booking } from '@/api/schemas';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { splitBookings } from '@/features/booking/split-bookings';
import { useQuery } from '@/hooks/use-query';
import { formatDateTime } from '@/lib/date';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

const STATUS: Record<Booking['status'], { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', color: colors.success, bg: colors.successSoft },
  pending: { label: 'Awaiting confirmation', color: colors.warning, bg: '#FFFAEB' },
  cancelled: { label: 'Cancelled', color: colors.danger, bg: colors.dangerSoft },
  completed: { label: 'Completed', color: colors.textMuted, bg: colors.surface },
};
const MODE_LABEL = { audio: 'Audio call', video: 'Video call', chat: 'Chat' } as const;
const CANCEL_REASONS = ['Schedule conflict', 'Feeling better', 'Want a different counsellor', 'Other'];

export default function SessionsScreen() {
  const api = useApi();
  const query = useQuery(() => api.bookings.list(), []);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doCancel() {
    if (!cancelling || !reason) return;
    setBusy(true);
    try {
      await api.bookings.cancel(cancelling.id, reason);
      setCancelling(null);
      setReason(null);
      query.reload();
      Alert.alert('Session cancelled', 'Your session has been cancelled.');
    } catch (e) {
      Alert.alert('Could not cancel', friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (query.loading) return <LoadingState />;
  if (query.error || !query.data) return <ErrorState error={query.error} onRetry={query.reload} />;

  const { upcoming, past } = splitBookings(query.data.items);
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <Screen edges={['bottom']} onRefresh={query.reload}>
      <View style={styles.tabs}>
        <Chip label={`Upcoming (${upcoming.length})`} selected={tab === 'upcoming'} onPress={() => setTab('upcoming')} />
        <Chip label={`Past (${past.length})`} selected={tab === 'past'} onPress={() => setTab('past')} />
      </View>

      {list.length === 0 ? (
        <EmptyState
          title={tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions yet'}
          message="Book a confidential session with one of our certified counsellors."
          Icon={CalendarDays}
          action={{ label: 'Find a counsellor', onPress: () => router.push('/counsellors') }}
        />
      ) : (
        list.map((b) => {
          const s = STATUS[b.status];
          return (
            <Card key={b.id} testID={`booking-${b.id}`}>
              <View style={styles.cardHead}>
                <AppText variant="subheading" style={styles.flex}>
                  Session with {b.counsellorName}
                </AppText>
                <View style={[styles.badge, { backgroundColor: s.bg }]}>
                  <AppText variant="caption" color={s.color}>
                    {s.label}
                  </AppText>
                </View>
              </View>
              <AppText color={colors.textMuted}>
                {formatDateTime(b.start)} · {MODE_LABEL[b.mode]}
              </AppText>
              {b.issue ? <AppText variant="caption">Topic: {b.issue}</AppText> : null}
              <View style={styles.actions}>
                {b.joinUrl && b.status === 'confirmed' && tab === 'upcoming' && /^https:\/\//.test(b.joinUrl) ? (
                  <Button compact label="Join session" onPress={() => void Linking.openURL(b.joinUrl!)} />
                ) : null}
                {b.cancellable && tab === 'upcoming' ? (
                  <Button
                    compact
                    variant="outline"
                    label="Cancel"
                    testID={`cancel-${b.id}`}
                    onPress={() => setCancelling(b)}
                  />
                ) : null}
              </View>
            </Card>
          );
        })
      )}

      <Modal visible={!!cancelling} transparent animationType="slide" onRequestClose={() => setCancelling(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <AppText variant="heading">Cancel this session?</AppText>
            {cancelling ? (
              <AppText color={colors.textMuted}>
                {cancelling.counsellorName} · {formatDateTime(cancelling.start)}
              </AppText>
            ) : null}
            <AppText variant="label">Please tell us why</AppText>
            <ScrollView contentContainerStyle={styles.reasons}>
              {CANCEL_REASONS.map((r) => (
                <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
              ))}
            </ScrollView>
            <Button
              testID="confirm-cancel"
              variant="danger"
              label="Cancel session"
              onPress={() => void doCancel()}
              disabled={!reason}
              loading={busy}
            />
            <Button
              variant="ghost"
              label="Keep session"
              onPress={() => {
                setCancelling(null);
                setReason(null);
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
