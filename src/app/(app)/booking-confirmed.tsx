import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { bookingStatusSchema, sessionModeSchema } from '@/api/schemas';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { formatDateTime, googleCalendarUrl } from '@/lib/date';
import { colors, spacing } from '@/theme';

const MODE_LABEL = { audio: 'Audio call', video: 'Video call', chat: 'Chat' } as const;

export default function BookingConfirmedScreen() {
  const params = useLocalSearchParams<{
    id: string;
    status: string;
    counsellorName: string;
    start: string;
    end: string;
    mode: string;
  }>();
  const status = bookingStatusSchema.catch('pending').parse(params.status);
  const mode = sessionModeSchema.catch('video').parse(params.mode);
  // Only an explicit server "confirmed" status is ever shown as confirmed.
  const confirmed = status === 'confirmed';
  const validTimes = !Number.isNaN(Date.parse(params.start ?? '')) && !Number.isNaN(Date.parse(params.end ?? ''));

  return (
    <Screen edges={['bottom']} contentStyle={styles.content}>
      <View style={styles.hero}>
        <Ionicons
          name={confirmed ? 'checkmark-circle' : 'time'}
          size={88}
          color={confirmed ? colors.success : colors.warning}
        />
        <AppText variant="display" align="center" testID="booking-status-title">
          {confirmed ? 'Booking Confirmed!' : 'Booking Request Received'}
        </AppText>
        <AppText align="center" color={colors.textMuted}>
          {confirmed
            ? 'Your session is booked successfully. You will receive a reminder before it starts.'
            : 'Your request has been sent. We will notify you as soon as the counsellor confirms.'}
        </AppText>
      </View>

      <Card>
        <Detail label="Counsellor" value={params.counsellorName ?? ''} />
        {validTimes ? <Detail label="Date & Time" value={formatDateTime(params.start)} /> : null}
        <Detail label="Session Type" value={MODE_LABEL[mode]} />
        {params.id ? <Detail label="Booking ID" value={params.id} /> : null}
      </Card>

      <View style={styles.actions}>
        {confirmed && validTimes ? (
          <Button
            variant="outline"
            label="Add to Calendar"
            icon={<Ionicons name="calendar-outline" size={20} color={colors.primary} />}
            onPress={() =>
              void Linking.openURL(
                googleCalendarUrl({
                  title: `CecureUs session with ${params.counsellorName ?? 'your counsellor'}`,
                  start: params.start,
                  end: params.end,
                  details: 'Open the CecureUs app to join your session.',
                }),
              )
            }
          />
        ) : null}
        <Button testID="go-to-sessions" label="Go to My Sessions" onPress={() => router.replace('/sessions')} />
        <Button variant="ghost" label="Back to Home" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="label" color={colors.textMuted}>
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: spacing.md },
  detail: { paddingVertical: spacing.sm, gap: spacing.xxs },
  actions: { gap: spacing.md },
});
