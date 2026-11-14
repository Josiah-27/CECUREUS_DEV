import type { Tabs } from 'expo-router';
import CircleUserRound from 'lucide-react-native/icons/circle-user-round';
import Compass from 'lucide-react-native/icons/compass';
import Home from 'lucide-react-native/icons/house';
import UserRound from 'lucide-react-native/icons/user-round';
import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing } from '@/theme';

import { LogoMark } from './brand';
import { AppText } from './ui';
import { GlassSheen } from './ui/glass';

const LENS_WIDTH = 68;

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  explore: Compass,
  counsellors: UserRound,
  profile: CircleUserRound,
};

/** Bottom navigation from the design, with the raised Ally button in the centre. */
export function CecureTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const itemWidth = (barWidth - spacing.xs * 2) / state.routes.length;
  const onAlly = state.routes[state.index]?.name === 'ally';
  const [slide] = useState(() => new Animated.Value(state.index));
  const shown = useRef(state.index);
  useEffect(() => {
    if (shown.current === state.index) return;
    shown.current = state.index;
    const spring = Animated.spring(slide, { toValue: state.index, useNativeDriver: Platform.OS !== 'web', speed: 18, bounciness: 9 });
    spring.start();
    return () => spring.stop();
  }, [slide, state.index]);

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {barWidth > 0 && !onAlly ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.lens,
            {
              left: spacing.xs + (itemWidth - LENS_WIDTH) / 2,
              transform: [{ translateX: Animated.multiply(slide, itemWidth) }],
            },
          ]}
        >
          <GlassSheen radius={radius.xl} tone="light" />
        </Animated.View>
      ) : null}
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;
        const isAlly = route.name === 'ally';
        const Icon = ICONS[route.name] ?? Home;
        const color = focused ? colors.primary : colors.textMuted;

        function onPress() {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
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
                <GlassSheen radius={26} />
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
  lens: {
    position: 'absolute',
    top: 3,
    width: LENS_WIDTH,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(23, 184, 176, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(23, 184, 176, 0.3)',
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
