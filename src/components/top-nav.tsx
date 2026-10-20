import { router } from 'expo-router';
import Bell from 'lucide-react-native/icons/bell';
import Menu from 'lucide-react-native/icons/menu';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppMenu } from './app-menu';
import { BrandLockup } from './brand';

/** Top bar from the design: menu, CecureUs lockup, notifications. */
export function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <View style={styles.bar} testID="top-nav">
      <Pressable
        testID="open-menu"
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        onPress={() => setMenuOpen(true)}
        hitSlop={12}
        style={styles.icon}
      >
        <Menu size={22} color={colors.textMuted} />
      </Pressable>
      <BrandLockup />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={() => router.push('/notifications')}
        hitSlop={12}
        style={styles.icon}
      >
        <Bell size={22} color={colors.textMuted} />
      </Pressable>
      <AppMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
