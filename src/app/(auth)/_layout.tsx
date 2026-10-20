import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitle: '',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="choose" options={{ title: 'Get started' }} />
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="register" options={{ title: 'Create account' }} />
    </Stack>
  );
}
