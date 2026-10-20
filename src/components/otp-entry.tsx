import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ApiError, friendlyMessage } from '@/api/errors';
import type { OtpRequest } from '@/api/schemas';
import { OTP_LENGTH } from '@/config/constants';
import { useCountdown } from '@/hooks/use-countdown';
import { formatClock } from '@/lib/breathing';
import { sanitizeOtp, validateOtp } from '@/lib/validation';
import { colors, radius, spacing } from '@/theme';

import { AppText, Button } from './ui';

type Props = {
  /** Where the code was sent, e.g. "you@example.com" or "+91 98765 43210". */
  destination: string;
  initial: OtpRequest;
  /** Verifies the code against `requestId`; throws ApiError on failure. */
  onVerify: (requestId: string, code: string) => Promise<void>;
  /** Requests a fresh code. */
  onResend: () => Promise<OtpRequest>;
  /** "Change email" / "Change number". */
  onChangeDestination: () => void;
  changeLabel: string;
};

/**
 * Six-digit OTP entry with server-driven expiry and resend cooldown.
 * Used for both email and mobile verification during sign-up.
 */
export function OtpEntry({ destination, initial, onVerify, onResend, onChangeDestination, changeLabel }: Props) {
  const [requestId, setRequestId] = useState(initial.requestId);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const expiry = useCountdown(initial.expiresInSeconds);
  const resend = useCountdown(initial.resendAfterSeconds);
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
      await onVerify(requestId, value);
    } catch (e) {
      setCode('');
      setError(
        e instanceof ApiError && e.code === 'OTP_EXPIRED'
          ? 'This code has expired. Please request a new one.'
          : friendlyMessage(e),
      );
      setVerifying(false);
    }
  }

  async function resendCode() {
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const otp = await onResend();
      setRequestId(otp.requestId);
      expiry.restart(otp.expiresInSeconds);
      resend.restart(otp.resendAfterSeconds);
      setCode('');
      setNotice('A new code has been sent.');
      inputRef.current?.focus();
    } catch (e) {
      if (e instanceof ApiError && e.kind === 'rate_limited' && e.retryAfterSeconds) resend.restart(e.retryAfterSeconds);
      setError(friendlyMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <AppText color={colors.textMuted}>
        We sent a {OTP_LENGTH}-digit code to <AppText variant="bodyStrong">{destination}</AppText>
      </AppText>

      <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
        <View style={styles.boxes} aria-hidden>
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
      <Button testID="change-destination" variant="ghost" compact label={changeLabel} onPress={onChangeDestination} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
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
    backgroundColor: colors.background,
  },
  boxActive: { borderColor: colors.teal },
  boxError: { borderColor: colors.danger },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
