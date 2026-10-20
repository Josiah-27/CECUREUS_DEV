import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, friendlyMessage } from '@/api/errors';
import { userTypeSchema } from '@/api/schemas';
import { useAuth } from '@/auth/auth-provider';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { validateEmail } from '@/lib/validation';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ userType?: string }>();
  const userType = userTypeSchema.catch('individual').parse(params.userType);
  const isCorporate = userType === 'corporate';
  const { requestOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const validation = validateEmail(email);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const otp = await requestOtp(email, userType);
      router.push({
        pathname: '/verify',
        params: {
          email: email.trim().toLowerCase(),
          userType,
          requestId: otp.requestId,
          expiresIn: String(otp.expiresInSeconds),
          resendAfter: String(otp.resendAfterSeconds),
        },
      });
    } catch (e) {
      if (e instanceof ApiError && e.kind === 'rate_limited' && e.retryAfterSeconds) {
        setError(`Please wait ${e.retryAfterSeconds} seconds before requesting another code.`);
      } else {
        setError(friendlyMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.header}>
        <AppText variant="display">{isCorporate ? 'Corporate sign in' : 'Sign in'}</AppText>
        <AppText color={colors.textMuted}>
          {isCorporate
            ? 'Enter your work email. We will verify that your organisation is registered with CecureUs.'
            : 'Enter your email address and we will send you a one-time code.'}
        </AppText>
      </View>

      <TextField
        testID="email-input"
        label={isCorporate ? 'Work email' : 'Email address'}
        placeholder={isCorporate ? 'name@company.com' : 'you@example.com'}
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (error) setError(null);
        }}
        error={error}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={submit}
        editable={!submitting}
      />

      <Button testID="send-code" label="Send code" onPress={submit} loading={submitting} />

      <AppText variant="caption" color={colors.textMuted}>
        The code is valid for 10 minutes. We never share your email with your employer.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
});
