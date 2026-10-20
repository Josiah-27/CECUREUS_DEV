import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';

import { Logo } from '@/components/logo';
import { colors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? active : inactive} size={24} color={color} />;
  };
}

function AllyIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[styles.ally, focused && styles.allyFocused]}>
      <Logo variant="mark" height={26} />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { borderTopColor: colors.border, minHeight: 64 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: tabIcon('compass', 'compass-outline') }} />
      <Tabs.Screen name="ally" options={{ title: 'Ally', tabBarIcon: AllyIcon }} />
      <Tabs.Screen
        name="counsellors"
        options={{ title: 'Counsellor', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('person-circle', 'person-circle-outline') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  ally: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginTop: -6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  allyFocused: { borderColor: colors.primary },
});
