import CalendarX from 'lucide-react-native/icons/calendar-x';
import MessageCircle from 'lucide-react-native/icons/message-circle';
import Phone from 'lucide-react-native/icons/phone';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Video from 'lucide-react-native/icons/video';
import type { LucideIcon } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { friendlyMessage } from '@/api/errors';
import type { SessionMode } from '@/api/schemas';
import { useAuth } from '@/auth/auth-provider';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Screen, TextField } from '@/components/ui';
import { createBookingSubmitter } from '@/features/booking/booking-submitter';
import { useNow } from '@/hooks/use-now';
import { useQuery } from '@/hooks/use-query';
import { addDays, deviceTimeZone, formatDayLabel, formatTime, toYmd } from '@/lib/date';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

const DAYS_AHEAD = 14;
const MAX_NOTES = 500;
const MODES: { id: SessionMode; label: string; Icon: LucideIcon }[] = [
  { id: 'audio', label: 'Audio', Icon: Phone },
  { id: 'video', label: 'Video', Icon: Video },
  { id: 'chat', label: 'Chat', Icon: MessageCircle },
];

export default function BookSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const counsellorId = String(id);
  const api = useApi();
  const { user } = useAuth();
  const submitter = useRef(createBookingSubmitter(api)).current;

  const counsellor = useQuery(() => api.counsellors.get(counsellorId), [counsellorId]);
  const issues = useQuery(() => api.reference.issues(), []);
  const availability = useQuery(() => {
    const today = new Date();
    return api.counsellors.availability(counsellorId, toYmd(today), toYmd(addDays(today, DAYS_AHEAD - 1)));
  }, [counsellorId]);

  // Availability can go stale while the user is away from this screen.
  const reloadAvailability = availability.reload;
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      reloadAvailability();
    }, [reloadAvailability]),
  );

  const [date, setDate] = useState<string | null>(null);
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [mode, setMode] = useState<SessionMode | null>(null);
  const [issueId, setIssueId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Re-evaluated every 30s so slots that have just started disappear.
  const now = useNow(30000);
  const days = useMemo(() => {
    return (availability.data?.days ?? [])
      .map((d) => ({ ...d, slots: d.slots.filter((s) => Date.parse(s.start) > now) }))
      .filter((d) => d.slots.length > 0);
  }, [availability.data, now]);

  const activeDate = date && days.some((d) => d.date === date) ? date : (days[0]?.date ?? null);
  const slots = days.find((d) => d.date === activeDate)?.slots ?? [];
  const serverTz = availability.data?.timezone;
  const localTz = deviceTimeZone();

  async function confirm() {
    if (!slotStart || !mode) return;
    setSubmitError(null);
    setSubmitting(true);
    const result = await submitter.submit({
      counsellorId,
      slotStart,
      mode,
      issueId,
      language,
      notes: notes.trim() ? notes.trim() : null,
    });
    setSubmitting(false);
    if (result.ok) {
      const b = result.booking;
      router.replace({
        pathname: '/booking-confirmed',
        params: { id: b.id, status: b.status, counsellorName: b.counsellorName, start: b.start, end: b.end, mode: b.mode },
      });
      return;
    }
    if (result.reason === 'in_flight') return;
    if (result.reason === 'slot_unavailable' || result.reason === 'slot_in_past') {
      setSlotStart(null);
      setSubmitError(
        result.reason === 'slot_in_past'
          ? 'That time has already passed. Please choose another slot.'
          : 'That slot was just booked by someone else. Please choose another time.',
      );
      availability.reload();
      return;
    }
    setSubmitError(`${friendlyMessage(result.error)} Your booking was not confirmed — tap Confirm to retry safely.`);
  }

  if (counsellor.loading) return <LoadingState />;
  if (counsellor.error || !counsellor.data) return <ErrorState error={counsellor.error} onRetry={counsellor.reload} />;
  const c = counsellor.data;
  const allowedModes = MODES.filter((m) => c.modes.includes(m.id));
  const canConfirm = !!slotStart && !!mode && !submitting;

  return (
    <Screen
      edges={['bottom']}
      footer={
        <View style={styles.footerWrap}>
          {submitError ? (
            <AppText testID="booking-error" color={colors.danger} accessibilityLiveRegion="assertive">
              {submitError}
            </AppText>
          ) : null}
          <Button
            testID="confirm-booking"
            label="Confirm Booking"
            onPress={() => void confirm()}
            loading={submitting}
            disabled={!canConfirm}
            accessibilityHint={canConfirm ? undefined : 'Choose a date, time and session type first'}
          />
        </View>
      }
    >
      <View style={styles.titleBlock}>
        <AppText variant="title">{c.name}</AppText>
        {c.title ? <AppText color={colors.textMuted}>{c.title}</AppText> : null}
      </View>

      <Step n={1} title="Choose Date">
        {availability.loading ? (
          <LoadingState label="Checking availability…" />
        ) : availability.error ? (
          <ErrorState error={availability.error} onRetry={availability.reload} />
        ) : days.length === 0 ? (
          <EmptyState
            title="No available slots"
            message={`${c.name} has no open slots in the next ${DAYS_AHEAD} days. Please check back later or choose another counsellor.`}
            Icon={CalendarX}
            action={{ label: 'Refresh', onPress: availability.reload }}
          />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {days.map((d) => {
              const label = formatDayLabel(d.date);
              const selected = d.date === activeDate;
              return (
                <Pressable
                  key={d.date}
                  testID={`day-${d.date}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${label.weekday} ${label.day} ${label.month}, ${d.slots.length} slots`}
                  onPress={() => {
                    setDate(d.date);
                    setSlotStart(null);
                  }}
                  style={[styles.day, selected && styles.daySelected]}
                >
                  <AppText variant="caption" color={selected ? '#FFFFFF' : colors.textMuted}>
                    {label.weekday}
                  </AppText>
                  <AppText variant="heading" color={selected ? '#FFFFFF' : colors.text}>
                    {label.day}
                  </AppText>
                  <AppText variant="caption" color={selected ? '#FFFFFF' : colors.textMuted}>
                    {label.month}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </Step>

      {days.length > 0 ? (
        <Step n={2} title="Choose Time Slot">
          <View style={styles.slots}>
            {slots.map((s) => (
              <Chip
                key={s.start}
                testID={`slot-${s.start}`}
                label={formatTime(s.start)}
                selected={slotStart === s.start}
                onPress={() => setSlotStart(s.start)}
              />
            ))}
          </View>
          <AppText variant="caption" color={colors.textMuted}>
            Times are shown in your time zone ({localTz})
            {serverTz && serverTz !== localTz ? `. The counsellor is in ${serverTz}.` : '.'}
          </AppText>
        </Step>
      ) : null}

      <Step n={3} title="Select Mode">
        <View style={styles.modes}>
          {allowedModes.map((m) => {
            const selected = mode === m.id;
            return (
              <Pressable
                key={m.id}
                testID={`mode-${m.id}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${m.label} session`}
                onPress={() => setMode(m.id)}
                style={[styles.mode, selected && styles.modeSelected]}
              >
                <m.Icon size={22} color={selected ? colors.teal : colors.textMuted} />
                <AppText variant="label" color={selected ? colors.primary : colors.text}>
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Step>

      <Step n={4} title="Anything else? (optional)">
        {issues.data && issues.data.length ? (
          <View style={styles.optionGroup}>
            <AppText variant="label">What would you like to talk about?</AppText>
            <View style={styles.slots}>
              {issues.data.map((i) => (
                <Chip
                  key={i.id}
                  label={i.name}
                  selected={issueId === i.id}
                  onPress={() => setIssueId(issueId === i.id ? null : i.id)}
                />
              ))}
            </View>
          </View>
        ) : null}
        {c.languages.length > 1 ? (
          <View style={styles.optionGroup}>
            <AppText variant="label">Preferred language</AppText>
            <View style={styles.slots}>
              {c.languages.map((l) => (
                <Chip key={l} label={l} selected={language === l} onPress={() => setLanguage(language === l ? null : l)} />
              ))}
            </View>
          </View>
        ) : null}
        <TextField
          label="Notes for your counsellor"
          placeholder="Share anything that will help your counsellor prepare"
          value={notes}
          onChangeText={(t) => setNotes(t.slice(0, MAX_NOTES))}
          multiline
          hint={`${notes.length}/${MAX_NOTES} · Visible only to your counsellor`}
        />
      </Step>

      {user?.userType === 'corporate' ? (
        <Card tone="soft" testID="covered-notice">
          <View style={styles.covered}>
            <ShieldCheck size={24} color={colors.teal} />
            <AppText style={styles.flex}>Covered under your organisation&apos;s wellness program. No payment needed.</AppText>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHeader}>
        <View style={styles.stepNum}>
          <AppText variant="label" color="#FFFFFF">
            {n}
          </AppText>
        </View>
        <AppText variant="heading">{title}</AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: spacing.xxs },
  step: { gap: spacing.md },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  days: { gap: spacing.sm },
  day: {
    width: 64,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  modes: { flexDirection: 'row', gap: spacing.sm },
  mode: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  modeSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionGroup: { gap: spacing.sm },
  covered: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  footerWrap: { gap: spacing.sm },
});
