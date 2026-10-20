import type { Tabs } from 'expo-router';
import CircleUserRound from 'lucide-react-native/icons/circle-user-round';
import Compass from 'lucide-react-native/icons/compass';
import Home from 'lucide-react-native/icons/house';
import UserRound from 'lucide-react-native/icons/user-round';
import type { LucideIcon } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, shadow, spacing } from '@/theme';

import { LogoMark } from './brand';
import { AppText } from './ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  explore: Compass,
  counsellors: UserRound,
  profile: CircleUserRound,
};

/** Bottom navigation from the design, with the raised Ally button in the centre. */
export function CecureTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const isAlly = route.name === 'ally';
        const Icon = ICONS[route.name] ?? Home;
        const color = focused ? colors.primary : colors.textMuted;

        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        }

        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.item}
          >
            {isAlly ? (
              <View style={[styles.ally, shadow.raised]}>
                <View style={styles.allyInner}>
                  <LogoMark size={22} />
                </View>
              </View>
            ) : (
              <Icon size={22} color={focused ? colors.teal : colors.textMuted} />
            )}
            <AppText variant="micro" color={color}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48, justifyContent: 'flex-end' },
  ally: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -24,
    backgroundColor: colors.teal,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allyInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
