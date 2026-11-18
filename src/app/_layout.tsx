import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getApi } from '@/api';
import { AuthProvider, useAuth } from '@/auth/auth-provider';
import { DemoBadge } from '@/components/demo-badge';
import { AppText } from '@/components/ui';
import { getEnv } from '@/config/env';
import { BetaCodeScreen, useBetaGate } from '@/features/beta/beta-gate';
import { installWebAlertShim } from '@/lib/web-alert-shim';
import { ApiProvider } from '@/providers/api-provider';
import { colors, spacing } from '@/theme';

void SplashScreen.preventAutoHideAsync();
installWebAlertShim();

function RootNavigator() {
  const { status } = useAuth();
  const beta = useBetaGate();
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });
  // If fonts fail to load we continue with the system font rather than blocking the app.
  const ready = status !== 'loading' && beta.state !== 'checking' && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  // c_beta test build only: ask for the beta code before anything else opens.
  if (beta.state === 'locked') return <BetaCodeScreen onSubmit={beta.unlock} />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.screen } }}>
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
      return { api: getApi(), error: null, demo: getEnv().demoMode };
    } catch (e) {
      return { api: null, error: e instanceof Error ? e.message : 'Invalid configuration', demo: false };
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {setup.api ? (
        <ApiProvider api={setup.api}>
          <AuthProvider>
            <RootNavigator />
            {setup.demo ? <DemoBadge /> : null}
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
