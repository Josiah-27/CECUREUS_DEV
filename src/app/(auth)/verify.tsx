import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, friendlyMessage } from '@/api/errors';
import { userTypeSchema } from '@/api/schemas';
import { useAuth } from '@/auth/auth-provider';
import { AppText, Button, Screen } from '@/components/ui';
import { OTP_LENGTH } from '@/config/constants';
import { useCountdown } from '@/hooks/use-countdown';
import { formatClock } from '@/lib/breathing';
import { sanitizeOtp, validateOtp } from '@/lib/validation';
import { colors, radius, spacing } from '@/theme';

function toSeconds(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export default function VerifyScreen() {
  const params = useLocalSearchParams<{
    email: string;
    userType: string;
    requestId: string;
    expiresIn: string;
    resendAfter: string;
  }>();
  const userType = userTypeSchema.catch('individual').parse(params.userType);
  const email = params.email ?? '';
  const { verifyOtp, requestOtp } = useAuth();

  const [requestId, setRequestId] = useState(params.requestId ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const expiry = useCountdown(toSeconds(params.expiresIn, 600));
  const resend = useCountdown(toSeconds(params.resendAfter, 60));
  const inputRef = useRef<TextInput>(null);
  const expired = expiry.remaining === 0;

  async function submit(value = code) {
    const validation = validateOtp(value);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      // On success the auth guard swaps to the signed-in app automatically.
      await verifyOtp(requestId, email, value);
    } catch (e) {
      setCode('');
      if (e instanceof ApiError && e.code === 'OTP_EXPIRED') {
        setError('This code has expired. Please request a new one.');
      } else {
        setError(friendlyMessage(e));
      }
      setVerifying(false);
    }
  }

  async function resendCode() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const otp = await requestOtp(email, userType);
      setRequestId(otp.requestId);
      expiry.restart(otp.expiresInSeconds);
      resend.restart(otp.resendAfterSeconds);
      setCode('');
      setNotice('A new code has been sent to your email.');
      inputRef.current?.focus();
    } catch (e) {
      if (e instanceof ApiError && e.kind === 'rate_limited' && e.retryAfterSeconds) {
        resend.restart(e.retryAfterSeconds);
      }
      setError(friendlyMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.header}>
        <AppText variant="display">Enter code</AppText>
        <AppText color={colors.textMuted}>
          We sent a {OTP_LENGTH}-digit code to <AppText variant="bodyStrong">{email}</AppText>
        </AppText>
      </View>

      <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
        <View style={styles.boxes} importantForAccessibility="no-hide-descendants">
          {Array.from({ length: OTP_LENGTH }, (_, i) => (
            <View key={i} style={[styles.box, code.length === i && styles.boxActive, error && styles.boxError]}>
              <AppText variant="title">{code[i] ?? ''}</AppText>
            </View>
          ))}
        </View>
      </Pressable>
      <TextInput
        ref={inputRef}
        testID="otp-input"
        accessibilityLabel="One-time code"
        value={code}
        onChangeText={(t) => {
          const clean = sanitizeOtp(t);
          setCode(clean);
          if (error) setError(null);
          if (clean.length === OTP_LENGTH && !expired) void submit(clean);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH + 4}
        autoFocus
        editable={!verifying}
        style={styles.hiddenInput}
      />

      {error ? (
        <AppText testID="otp-error" color={colors.danger} accessibilityLiveRegion="assertive">
          {error}
        </AppText>
      ) : null}
      {notice ? (
        <AppText color={colors.success} accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      ) : null}

      <AppText variant="caption" color={expired ? colors.danger : colors.textMuted} testID="otp-expiry">
        {expired ? 'This code has expired. Request a new one.' : `Code expires in ${formatClock(expiry.remaining)}`}
      </AppText>

      <Button
        testID="verify-code"
        label="Verify"
        onPress={() => void submit()}
        loading={verifying}
        disabled={expired || code.length !== OTP_LENGTH}
      />
      <Button
        testID="resend-code"
        variant="ghost"
        label={resend.remaining > 0 ? `Resend code in ${resend.remaining}s` : 'Resend code'}
        onPress={() => void resendCode()}
        disabled={resend.remaining > 0}
        loading={resending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
