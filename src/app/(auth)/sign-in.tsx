import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, friendlyMessage } from '@/api/errors';
import { useAuth } from '@/auth/auth-provider';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/config/constants';
import { colors, spacing } from '@/theme';

/** "I already have an account": sign in with user ID (email, mobile or employee ID) + password. */
export default function SignInScreen() {
  const { signIn } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!userId.trim() || !password) {
      setError('Enter your user ID and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // On success the auth guard swaps to the signed-in app automatically.
      await signIn(userId, password);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'LOGIN_LOCKED'
          ? 'Too many failed attempts. Please try again in 15 minutes.'
          : friendlyMessage(e),
      );
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.header}>
        <AppText variant="display">Welcome back</AppText>
        <AppText color={colors.textMuted}>Sign in to continue your wellness journey.</AppText>
      </View>

      <TextField
        testID="signin-user-id"
        label="User ID"
        hint="Your email, mobile number or employee ID"
        placeholder="you@example.com or 98765 43210"
        value={userId}
        onChangeText={(t) => {
          setUserId(t);
          if (error) setError(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        editable={!submitting}
      />
      <TextField
        testID="signin-password"
        label="Password"
        placeholder="Your password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          if (error) setError(null);
        }}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        editable={!submitting}
      />
      <Button
        compact
        variant="ghost"
        label={showPassword ? 'Hide password' : 'Show password'}
        onPress={() => setShowPassword((v) => !v)}
        style={styles.toggle}
      />

      {error ? (
        <AppText testID="signin-error" color={colors.danger} accessibilityLiveRegion="assertive">
          {error}
        </AppText>
      ) : null}

      <Button testID="signin-submit" label="Sign in" onPress={() => void submit()} loading={submitting} />

      <Card tone="soft">
        <AppText variant="bodyStrong">New to CecureUs?</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          Create an account as a corporate employee or an individual.
        </AppText>
        <Button
          testID="go-register"
          compact
          variant="outline"
          label="Create an account"
          onPress={() => router.replace('/choose')}
          style={styles.toggle}
        />
      </Card>

      <AppText variant="caption" color={colors.textMuted} align="center">
        Forgot your password? Email {SUPPORT_EMAIL} and our team will help you reset it.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  toggle: { alignSelf: 'flex-start', marginTop: -spacing.sm },
});
