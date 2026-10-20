import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { EmergencyBanner } from '@/components/emergency-banner';
import { AppText, Avatar, Button, Card, Screen, SectionHeader } from '@/components/ui';
import { getEnv } from '@/config/env';
import { splitBookings } from '@/features/booking/split-bookings';
import { useLocalCollection } from '@/hooks/use-local';
import { useQuery } from '@/hooks/use-query';
import { assessmentLogStore, goalStore } from '@/local/stores';
import { formatDateTime } from '@/lib/date';
import { useApi } from '@/providers/api-provider';
import { colors, spacing } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const api = useApi();
  const bookings = useQuery(() => api.bookings.list(), []);
  const assessments = useLocalCollection(() => assessmentLogStore.all());
  const goals = useLocalCollection(() => goalStore.all());
  const env = getEnv();

  if (!user) return null;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const items = bookings.data?.items ?? [];
  const sessionsTaken = items.filter((b) => b.status === 'completed').length;
  const recent = splitBookings(items).past.filter((b) => b.status === 'completed').slice(0, 3);

  function confirmLogout() {
    Alert.alert('Log out?', 'You will need to sign in again with a one-time code.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen testID="profile-screen" onRefresh={bookings.reload}>
      <AppText variant="display">My Profile</AppText>

      <View style={styles.header}>
        <Avatar name={fullName} size={72} />
        <View style={styles.flex}>
          <AppText variant="heading">{fullName}</AppText>
          <AppText color={colors.textMuted}>{user.email}</AppText>
          {user.mobile ? <AppText color={colors.textMuted}>{user.mobile}</AppText> : null}
          <AppText variant="caption" color={colors.primary}>
            {user.userType === 'corporate' ? `Corporate · ${user.companyName ?? 'Organisation member'}` : 'Individual'}
          </AppText>
        </View>
        <Button compact variant="outline" label="Edit" onPress={() => router.push('/edit-profile')} />
      </View>

      <EmergencyBanner />

      <View style={styles.section}>
        <AppText variant="heading">My Wellness Overview</AppText>
        <View style={styles.stats}>
          <Stat icon="calendar-outline" value={bookings.data ? sessionsTaken : '—'} label="Sessions Taken" onPress={() => router.push('/sessions')} />
          <Stat icon="clipboard-outline" value={assessments.items.length} label="Assessments Done" onPress={() => router.push('/progress')} />
          <Stat
            icon="trophy-outline"
            value={goals.items.filter((g) => g.archived).length}
            label="Goals Achieved"
            onPress={() => router.push('/goals')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent Sessions" onAction={() => router.push('/sessions')} />
        {recent.length === 0 ? (
          <AppText color={colors.textMuted}>No completed sessions yet.</AppText>
        ) : (
          recent.map((b) => (
            <Card key={b.id}>
              <AppText variant="bodyStrong">Session with {b.counsellorName}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {formatDateTime(b.start)}
              </AppText>
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="heading">Account & Settings</AppText>
        <Card style={styles.menu}>
          <MenuItem icon="person-outline" label="Personal Information" href="/edit-profile" />
          <MenuItem icon="calendar-outline" label="My Sessions" href="/sessions" />
          <MenuItem icon="call-outline" label="Talk to Us" href="/talk-to-us" />
          <MenuItem icon="shield-checkmark-outline" label="Privacy & Safety" href="/privacy" />
          <MenuItem icon="document-text-outline" label="Terms of Use" onPress={() => void WebBrowser.openBrowserAsync(env.termsUrl)} />
          <MenuItem icon="trash-outline" label="Delete Account" href="/delete-account" danger />
        </Card>
      </View>

      <Button testID="logout" variant="ghost" label="Log Out" onPress={confirmLogout} icon={<Ionicons name="log-out-outline" size={20} color={colors.primary} />} />
    </Screen>
  );
}

function Stat({ icon, value, label, onPress }: { icon: IconName; value: number | string; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={styles.stat}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <AppText variant="title">{String(value)}</AppText>
      <AppText variant="caption" color={colors.textMuted} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

function MenuItem({
  icon,
  label,
  href,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  href?: Href;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress ?? (() => href && router.push(href))}
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.surface }]}
    >
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.text} />
      <AppText style={styles.flex} color={danger ? colors.danger : colors.text}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  section: { gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: spacing.xxs, paddingVertical: spacing.md, borderRadius: 16, backgroundColor: colors.surface },
  menu: { padding: 0, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg },
});
