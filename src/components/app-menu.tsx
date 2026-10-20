import { router, type Href } from 'expo-router';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Compass from 'lucide-react-native/icons/compass';
import Home from 'lucide-react-native/icons/house';
import LogOut from 'lucide-react-native/icons/log-out';
import Phone from 'lucide-react-native/icons/phone';
import Shield from 'lucide-react-native/icons/shield';
import User from 'lucide-react-native/icons/user';
import UserRound from 'lucide-react-native/icons/user-round';
import X from 'lucide-react-native/icons/x';
import type { LucideIcon } from 'lucide-react-native';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-provider';
import { colors, radius, spacing } from '@/theme';

import { BrandLockup } from './brand';
import { AppText } from './ui';

const ITEMS: { label: string; href: Href; Icon: LucideIcon }[] = [
  { label: 'Home', href: '/', Icon: Home },
  { label: 'Explore', href: '/explore', Icon: Compass },
  { label: 'Counsellors', href: '/counsellors', Icon: UserRound },
  { label: 'My Sessions', href: '/sessions', Icon: CalendarDays },
  { label: 'Profile', href: '/profile', Icon: User },
  { label: 'Help & Support', href: '/talk-to-us', Icon: Phone },
  { label: 'Privacy & Safety', href: '/privacy', Icon: Shield },
];

/** Side menu opened from the hamburger in the top bar. */
export function AppMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  function go(href: Href) {
    onClose();
    router.navigate(href);
  }

  function logout() {
    onClose();
    Alert.alert('Log out?', 'You will need to sign in again with a one-time code.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.head}>
            <BrandLockup />
            <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {ITEMS.map(({ label, href, Icon }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => go(href)}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.tealLight }]}
            >
              <Icon size={20} color={colors.teal} />
              <AppText variant="bodyStrong">{label}</AppText>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            onPress={logout}
            style={({ pressed }) => [styles.item, styles.logout, pressed && { backgroundColor: colors.tealLight }]}
          >
            <LogOut size={20} color={colors.primary} />
            <AppText variant="bodyStrong" color={colors.primary}>
              Log Out
            </AppText>
          </Pressable>
        </View>
        <Pressable style={styles.scrim} accessibilityLabel="Close menu" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: colors.overlay },
  panel: {
    width: '78%',
    maxWidth: 320,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    borderTopRightRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  scrim: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  logout: { marginTop: spacing.lg },
});
