/**
 * Beta access code for the "c_beta" test build (docs/C_BETA.md).
 *
 * Only active when EXPO_PUBLIC_BETA_GATE=true (set by the `beta` / `beta-apk` EAS profiles), so normal
 * and production builds never show it. The code is checked on the phone and remembered on this device
 * once entered. It keeps casual installs out of the test build; it is NOT a security control.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/logo';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import * as SecureStore from '@/lib/kv-store';
import { colors, spacing } from '@/theme';

/** The fixed beta code (requested for the c_beta test build). */
export const BETA_CODE = 'AJDS';

const UNLOCK_KEY = 'cecureus.beta.unlocked.v1';

export type BetaGateState = 'checking' | 'locked' | 'open';

/** Read at call time so tests can switch it; Expo inlines the literal at build time. */
export function betaGateEnabled(): boolean {
  return process.env.EXPO_PUBLIC_BETA_GATE === 'true';
}

/** Case and surrounding spaces don't matter: "ajds " is accepted. */
export function isBetaCode(input: string): boolean {
  return input.trim().toUpperCase() === BETA_CODE;
}

/** 'open' when the gate is off or this device already entered the current code. */
export function useBetaGate() {
  const enabled = betaGateEnabled();
  const [state, setState] = useState<BetaGateState>(enabled ? 'checking' : 'open');

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    SecureStore.getItemAsync(UNLOCK_KEY)
      .then((saved) => {
        // Storing the code itself means a new code in a later build asks again.
        if (alive) setState(saved === BETA_CODE ? 'open' : 'locked');
      })
      .catch(() => {
        if (alive) setState('locked');
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  const unlock = useCallback(async (input: string): Promise<boolean> => {
    if (!isBetaCode(input)) return false;
    try {
      await SecureStore.setItemAsync(UNLOCK_KEY, BETA_CODE);
    } catch {
      // Storage unavailable: still open the app for this session.
    }
    setState('open');
    return true;
  }, []);

  return { state, unlock };
}

export function BetaCodeScreen({ onSubmit }: { onSubmit: (code: string) => Promise<boolean> }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    const ok = await onSubmit(code);
    if (!ok) {
      setError('That beta code is not correct. Check it and try again.');
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content} testID="beta-gate">
      <View style={styles.logo}>
        <Logo />
      </View>
      <AppText variant="title" align="center">
        Beta access
      </AppText>
      <AppText color={colors.textMuted} align="center">
        This is a test version of CecureUs. Enter the beta code you were given to continue.
      </AppText>
      <TextField
        label="Beta code"
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setError(null);
        }}
        error={error}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={12}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        testID="beta-code"
      />
      <Button label="Continue" onPress={() => void submit()} disabled={!code.trim()} loading={busy} testID="beta-submit" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
  logo: { alignItems: 'center', marginBottom: spacing.lg },
});
