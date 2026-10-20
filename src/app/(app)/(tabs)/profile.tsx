import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import BadgeCheck from 'lucide-react-native/icons/badge-check';
import BookOpen from 'lucide-react-native/icons/book-open';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import FileText from 'lucide-react-native/icons/file-text';
import LogOut from 'lucide-react-native/icons/log-out';
import Mail from 'lucide-react-native/icons/mail';
import Pencil from 'lucide-react-native/icons/pencil';
import Phone from 'lucide-react-native/icons/phone';
import Shield from 'lucide-react-native/icons/shield';
import Trash2 from 'lucide-react-native/icons/trash';
import User from 'lucide-react-native/icons/user';
import type { LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-provider';
import { ArticleCard } from '@/components/article-card';
import { EmergencyBanner } from '@/components/emergency-banner';
import { AppText, Avatar, Button, Card, Chip, Screen, SectionHeader } from '@/components/ui';
import { getEnv } from '@/config/env';
import { splitBookings } from '@/features/booking/split-bookings';
import { useLocalCollection } from '@/hooks/use-local';
import { useQuery } from '@/hooks/use-query';
import { assessmentLogStore, goalStore, readArticleStore } from '@/local/stores';
import { formatDateTime } from '@/lib/date';
import { useApi } from '@/providers/api-provider';
import { colors, fonts, radius, shadow, spacing } from '@/theme';

const MODE_LABEL = { audio: 'Phone Call', video: 'Video Call', chat: 'Chat' } as const;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const api = useApi();
  const bookings = useQuery(() => api.bookings.list(), []);
  const assessments = useLocalCollection(() => assessmentLogStore.all());
  const goals = useLocalCollection(() => goalStore.all());
  const read = useLocalCollection(() => readArticleStore.all());
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
      <View>
        <AppText variant="display">My Profile</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Manage your account and wellness journey.
        </AppText>
      </View>

      <Card>
        <View style={styles.userRow}>
          <View>
            <Avatar name={fullName} size={64} color={colors.teal} />
            <View style={styles.avatarBadge}>
              <User size={11} color={colors.teal} />
            </View>
          </View>
          <View style={styles.flex}>
            <AppText variant="subheading">{fullName}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {user.email}
            </AppText>
            {user.mobile ? (
              <AppText variant="caption" color={colors.textMuted}>
                {user.mobile}
              </AppText>
            ) : null}
            <View style={styles.verified}>
              <BadgeCheck size={13} color={colors.teal} />
              <AppText variant="micro" color={colors.primary}>
                {user.userType === 'corporate' ? `Verified · ${user.companyName ?? 'Corporate'}` : 'Verified'}
              </AppText>
            </View>
          </View>
        </View>
        <Button
          compact
          variant="outline"
          label="Edit Profile"
          icon={<Pencil size={13} color={colors.primary} />}
          onPress={() => router.push('/edit-profile')}
          style={styles.edit}
        />
      </Card>

      <EmergencyBanner compact />

      <View style={styles.section}>
        <AppText variant="subheading">My Wellness Overview</AppText>
        <View style={styles.stats}>
          <Stat emoji="📅" value={bookings.data ? sessionsTaken : '—'} label="Sessions Taken" action="View History" color={colors.teal} href="/sessions" />
          <Stat emoji="📓" value={read.items.length} label="Blogs Completed" action="View All" color={colors.amber} href="/articles" />
          <Stat emoji="📋" value={assessments.items.length} label="Assessments Done" action="View Results" color={colors.accentPurple} href="/progress" />
          <Stat
            emoji="🎯"
            value={goals.items.filter((g) => g.archived).length}
            label="Goals Achieved"
            action="View Goals"
            color={colors.accentGreen}
            href="/goals"
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Recent Sessions" onAction={() => router.push('/sessions')} />
        {recent.length === 0 ? (
          <AppText variant="caption" color={colors.textMuted}>
            No completed sessions yet.
          </AppText>
        ) : (
          recent.map((b) => (
            <Card key={b.id} style={styles.session} onPress={() => router.push('/sessions')} accessibilityLabel={`Session with ${b.counsellorName}`}>
              <Avatar name={b.counsellorName} size={40} />
              <View style={styles.flex}>
                <AppText variant="label" style={styles.bold} numberOfLines={1}>
                  Session with {b.counsellorName}
                </AppText>
                <AppText variant="micro" color={colors.textMuted}>
                  {formatDateTime(b.start)} · {MODE_LABEL[b.mode]}
                </AppText>
                {b.issue ? (
                  <View style={styles.tagRow}>
                    <Chip label={b.issue} kind="tag" />
                  </View>
                ) : null}
              </View>
              <BookOpen size={14} color={colors.teal} />
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="My Completed Blogs" onAction={() => router.push('/articles')} />
        {read.items.length === 0 ? (
          <AppText variant="caption" color={colors.textMuted}>
            Articles you mark as read will appear here.
          </AppText>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {read.items.slice(0, 8).map((a) => (
              <ArticleCard
                key={a.id}
                horizontal
                completed
                article={a}
                footnote={new Date(a.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="subheading">Account &amp; Settings</AppText>
        <Card style={styles.menu}>
          <MenuItem Icon={User} label="Personal Information" href="/edit-profile" />
          <MenuItem Icon={Mail} label="Contact Email" value={user.email} href="/edit-profile" />
          <MenuItem Icon={CalendarDays} label="My Sessions" href="/sessions" />
          <MenuItem Icon={Phone} label="Help & Support" href="/talk-to-us" />
          <MenuItem Icon={Shield} label="Privacy & Safety" href="/privacy" />
          <MenuItem Icon={FileText} label="Terms of Use" onPress={() => void WebBrowser.openBrowserAsync(env.termsUrl)} />
          <MenuItem Icon={Trash2} label="Delete Account" href="/delete-account" danger />
        </Card>
      </View>

      <Button
        testID="logout"
        variant="ghost"
        label="Log Out"
        onPress={confirmLogout}
        icon={<LogOut size={16} color={colors.primary} />}
      />
    </Screen>
  );
}

function Stat({
  emoji,
  value,
  label,
  action,
  color,
  href,
}: {
  emoji: string;
  value: number | string;
  label: string;
  action: string;
  color: string;
  href: Href;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${action}`}
      onPress={() => router.push(href)}
      style={[styles.stat, shadow.card]}
    >
      <View style={styles.statTop}>
        <AppText style={styles.statEmoji} importantForAccessibility="no">
          {emoji}
        </AppText>
        <AppText variant="title" color={color === colors.amber ? '#B45309' : color}>
          {String(value)}
        </AppText>
      </View>
      <AppText variant="micro" align="center">
        {label}
      </AppText>
      <AppText variant="micro" color={color === colors.amber ? '#B45309' : color} align="center">
        {action} ›
      </AppText>
    </Pressable>
  );
}

function MenuItem({
  Icon,
  label,
  value,
  href,
  onPress,
  danger,
}: {
  Icon: LucideIcon;
  label: string;
  value?: string;
  href?: Href;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress ?? (() => href && router.push(href))}
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: colors.screen }]}
    >
      <Icon size={16} color={danger ? colors.danger : colors.teal} />
      <AppText style={styles.flex} color={danger ? colors.danger : colors.text}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="micro" color={colors.textMuted} numberOfLines={1} style={styles.menuValue}>
          {value}
        </AppText>
      ) : null}
      <ChevronRight size={14} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: fonts.bold },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  edit: { alignSelf: 'flex-start', marginTop: spacing.md },
  section: { gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.xs + 2 },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statEmoji: { fontSize: 14, lineHeight: 20 },
  session: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  tagRow: { flexDirection: 'row', marginTop: 2 },
  row: { gap: spacing.sm, paddingRight: spacing.lg },
  menu: { padding: 0, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  menuValue: { maxWidth: 140 },
});
