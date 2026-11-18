import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, friendlyMessage } from '@/api/errors';
import type { OtpRequest } from '@/api/schemas';
import { useAuth } from '@/auth/auth-provider';
import { OtpEntry } from '@/components/otp-entry';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/config/constants';
import { formatIndianMobile, normalizeIndianMobile } from '@/lib/validation';
import { useApi } from '@/providers/api-provider';
import { colors, spacing } from '@/theme';

/**
 * "I already have an account": mobile number → SMS code.
 * Only active numbers in employee_list can sign in; new people create an account first.
 */
export default function SignInScreen() {
  const api = useApi();
  const { verifyOtp } = useAuth();
  const [mobileInput, setMobileInput] = useState('');
  const [mobile, setMobile] = useState<string | null>(null);
  const [otp, setOtp] = useState<OtpRequest | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; register: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode() {
    const phone = normalizeIndianMobile(mobileInput);
    if (!phone.value) {
      setFieldError(phone.error ?? 'Enter your mobile number.');
      return;
    }
    setFieldError(null);
    setError(null);
    setSubmitting(true);
    try {
      const request = await api.auth.requestOtp(phone.value);
      setMobile(phone.value);
      setOtp(request);
    } catch (e) {
      const message =
        e instanceof ApiError && e.kind === 'rate_limited' && e.retryAfterSeconds
          ? `Please wait ${e.retryAfterSeconds} seconds before requesting another code.`
          : friendlyMessage(e);
      setError({ message, register: e instanceof ApiError && e.code === 'NOT_REGISTERED' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.header}>
        <AppText variant="display">Welcome back</AppText>
        <AppText color={colors.textMuted}>Sign in to continue your wellness journey.</AppText>
      </View>

      {otp && mobile ? (
        <OtpEntry
          key={otp.requestId}
          destination={formatIndianMobile(mobile)}
          initial={otp}
          // On success the auth guard swaps to the signed-in app automatically.
          onVerify={(requestId, code) => verifyOtp(requestId, code)}
          onResend={() => api.auth.requestOtp(mobile)}
          onChangeDestination={() => {
            setOtp(null);
            setError(null);
          }}
          changeLabel="Use a different number"
        />
      ) : (
        <>
          <TextField
            testID="signin-mobile"
            label="Mobile number"
            hint="The number registered with CecureUs. We will send you a code by SMS."
            placeholder="10-digit mobile number"
            value={mobileInput}
            onChangeText={(t) => {
              setMobileInput(t);
              if (fieldError) setFieldError(null);
              if (error) setError(null);
            }}
            error={fieldError}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
            editable={!submitting}
          />

          {error ? (
            <AppText testID="signin-error" color={colors.danger} accessibilityLiveRegion="assertive">
              {error.message}
            </AppText>
          ) : null}

          <Button testID="signin-submit" label="Send code" onPress={() => void sendCode()} loading={submitting} />
        </>
      )}

      <Card tone="soft">
        <AppText variant="bodyStrong">New to CecureUs?</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {error?.register
            ? 'This number is not registered yet. Create an account to get started.'
            : 'Create an account as a corporate employee or an individual.'}
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
        Changed your mobile number? Email {SUPPORT_EMAIL} and our team will update it.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  toggle: { alignSelf: 'flex-start', marginTop: -spacing.sm },
});
