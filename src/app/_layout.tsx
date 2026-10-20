import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getApi } from '@/api';
import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { AppText } from '@/components/ui';
import { getEnv } from '@/config/env';
import { ApiProvider } from '@/providers/api-provider';
import { colors, spacing } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status !== 'signedIn'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

function ConfigError({ message }: { message: string }) {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);
  return (
    <View style={styles.error}>
      <AppText variant="title">Configuration error</AppText>
      <AppText color={colors.textMuted}>{message}</AppText>
    </View>
  );
}

export default function RootLayout() {
  const setup = useMemo(() => {
    try {
      getEnv();
      return { api: getApi(), error: null };
    } catch (e) {
      return { api: null, error: e instanceof Error ? e.message : 'Invalid configuration' };
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {setup.api ? (
        <ApiProvider api={setup.api}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ApiProvider>
      ) : (
        <ConfigError message={setup.error ?? 'Invalid configuration'} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
});
