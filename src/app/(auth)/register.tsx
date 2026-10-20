import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, friendlyMessage } from '@/api/errors';
import { userTypeSchema, type OtpRequest } from '@/api/schemas';
import { useAuth } from '@/auth/auth-provider';
import { OtpEntry } from '@/components/otp-entry';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { getEnv } from '@/config/env';
import {
  normalizeIndianMobile,
  validateEmail,
  validateEmployeeId,
  validateName,
  validatePassword,
} from '@/lib/validation';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

type Step = 'email' | 'emailOtp' | 'phone' | 'phoneOtp' | 'name' | 'password';

const STEP_NUMBER: Record<Step, number> = { email: 1, emailOtp: 1, phone: 2, phoneOtp: 2, name: 3, password: 4 };
const STEP_TITLES = ['Verify email', 'Verify mobile', 'About you', 'Set password'];
const TAKEN_CODES = new Set(['EMAIL_TAKEN', 'MOBILE_TAKEN']);

function formatMobile(e164: string) {
  const d = e164.replace(/^\+91/, '');
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

/**
 * Account creation: email OTP → mobile OTP → name → password.
 * Each step is confirmed by the server before moving on; the password stays in memory only.
 */
export default function RegisterScreen() {
  const params = useLocalSearchParams<{ userType?: string }>();
  const userType = userTypeSchema.catch('individual').parse(params.userType);
  const isCorporate = userType === 'corporate';
  const api = useApi();
  const { completeRegistration } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState<OtpRequest | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [mobileInput, setMobileInput] = useState('');
  const [mobile, setMobile] = useState<string | null>(null);
  const [phoneOtp, setPhoneOtp] = useState<OtpRequest | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<{ message: string; signIn: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  function showApiError(e: unknown) {
    const message =
      e instanceof ApiError && e.kind === 'rate_limited' && e.retryAfterSeconds
        ? `Please wait ${e.retryAfterSeconds} seconds before requesting another code.`
        : friendlyMessage(e);
    setFormError({ message, signIn: e instanceof ApiError && !!e.code && TAKEN_CODES.has(e.code) });
  }

  async function run(action: () => Promise<void>) {
    setFormError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      showApiError(e);
    } finally {
      setBusy(false);
    }
  }

  // Step 1 — email
  function sendEmailCode() {
    const error = validateEmail(email);
    setErrors({ email: error });
    if (error) return;
    void run(async () => {
      setEmailOtp(await api.auth.register.requestEmailOtp(email.trim().toLowerCase(), userType));
      setStep('emailOtp');
    });
  }

  // Step 2 — mobile
  function sendPhoneCode() {
    const phone = normalizeIndianMobile(mobileInput);
    const error = phone.value ? null : (phone.error ?? 'Enter your mobile number.');
    setErrors({ mobile: error });
    if (error || !phone.value || !registrationToken) return;
    const value = phone.value;
    void run(async () => {
      setPhoneOtp(await api.auth.register.requestPhoneOtp(registrationToken, value));
      setMobile(value);
      setStep('phoneOtp');
    });
  }

  // Step 3 — name
  function saveName() {
    const next = {
      firstName: validateName(firstName, 'First name'),
      lastName: lastName.trim() ? validateName(lastName, 'Last name') : null,
      employeeId: isCorporate ? validateEmployeeId(employeeId) : null,
    };
    setErrors(next);
    if (!next.firstName && !next.lastName && !next.employeeId) setStep('password');
  }

  // Step 4 — password + create
  function createAccount() {
    const next = {
      password: validatePassword(password),
      confirm: password === confirm ? null : 'Passwords do not match.',
    };
    setErrors(next);
    if (next.password || next.confirm || !registrationToken) return;
    const token = registrationToken;
    void run(async () => {
      // On success the auth guard swaps to the signed-in app automatically.
      await completeRegistration(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        password,
        employeeId: isCorporate && employeeId.trim() ? employeeId.trim() : null,
      });
    });
  }

  const current = STEP_NUMBER[step];

  return (
    <Screen edges={['bottom']} testID="register-screen">
      <View style={styles.header}>
        <AppText variant="display">{isCorporate ? 'Corporate sign up' : 'Create your account'}</AppText>
        <AppText variant="caption" color={colors.textMuted} testID="register-step">
          Step {current} of 4 · {STEP_TITLES[current - 1]}
        </AppText>
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 4, now: current }}>
          {STEP_TITLES.map((t, i) => (
            <View key={t} style={[styles.progressBar, i < current && styles.progressDone]} />
          ))}
        </View>
      </View>

      {step === 'email' ? (
        <>
          <AppText color={colors.textMuted}>
            {isCorporate
              ? 'Enter your work email. We will check that your organisation is registered with CecureUs.'
              : 'Enter your email address. We will send you a code to verify it.'}
          </AppText>
          <TextField
            testID="register-email"
            label={isCorporate ? 'Work email' : 'Email address'}
            placeholder={isCorporate ? 'name@company.com' : 'you@example.com'}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={sendEmailCode}
            editable={!busy}
          />
          <Button testID="send-email-code" label="Send code" onPress={sendEmailCode} loading={busy} />
        </>
      ) : null}

      {step === 'emailOtp' && emailOtp ? (
        <OtpEntry
          key={`email-${emailOtp.requestId}`}
          destination={email.trim().toLowerCase()}
          initial={emailOtp}
          onVerify={async (requestId, code) => {
            const { registrationToken: token } = await api.auth.register.verifyEmailOtp(requestId, code);
            setRegistrationToken(token);
            setFormError(null);
            setStep('phone');
          }}
          onResend={() => api.auth.register.requestEmailOtp(email.trim().toLowerCase(), userType)}
          onChangeDestination={() => setStep('email')}
          changeLabel="Use a different email"
        />
      ) : null}

      {step === 'phone' ? (
        <>
          <Card tone="soft">
            <AppText variant="label" color={colors.primary}>
              ✓ Email verified · {email.trim().toLowerCase()}
            </AppText>
          </Card>
          <AppText color={colors.textMuted}>Now verify your mobile number. We will send a code by SMS.</AppText>
          <TextField
            testID="register-mobile"
            label="Mobile number"
            placeholder="98765 43210"
            value={mobileInput}
            onChangeText={setMobileInput}
            error={errors.mobile}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="send"
            onSubmitEditing={sendPhoneCode}
            editable={!busy}
          />
          <Button testID="send-phone-code" label="Send code" onPress={sendPhoneCode} loading={busy} />
        </>
      ) : null}

      {step === 'phoneOtp' && phoneOtp && mobile && registrationToken ? (
        <OtpEntry
          key={`phone-${phoneOtp.requestId}`}
          destination={formatMobile(mobile)}
          initial={phoneOtp}
          onVerify={async (requestId, code) => {
            await api.auth.register.verifyPhoneOtp(registrationToken, requestId, code);
            setFormError(null);
            setStep('name');
          }}
          onResend={() => api.auth.register.requestPhoneOtp(registrationToken, mobile)}
          onChangeDestination={() => setStep('phone')}
          changeLabel="Use a different number"
        />
      ) : null}

      {step === 'name' ? (
        <>
          <Card tone="soft">
            <AppText variant="label" color={colors.primary}>
              ✓ Email and mobile verified
            </AppText>
          </Card>
          <AppText color={colors.textMuted}>Tell us what to call you.</AppText>
          <TextField
            testID="register-first-name"
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            error={errors.firstName}
            autoComplete="given-name"
            textContentType="givenName"
          />
          <TextField
            testID="register-last-name"
            label="Last name (optional)"
            value={lastName}
            onChangeText={setLastName}
            error={errors.lastName}
            autoComplete="family-name"
            textContentType="familyName"
          />
          {isCorporate ? (
            <TextField
              testID="register-employee-id"
              label="Employee ID (optional)"
              hint="You can also use it as your user ID to sign in"
              value={employeeId}
              onChangeText={setEmployeeId}
              error={errors.employeeId}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          ) : null}
          <Button testID="register-name-next" label="Continue" onPress={saveName} />
        </>
      ) : null}

      {step === 'password' ? (
        <>
          <Card tone="soft" testID="register-user-id">
            <AppText variant="label">Your user ID</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Sign in with your email ({email.trim().toLowerCase()})
              {mobile ? ` or mobile (${formatMobile(mobile)})` : ''}
              {isCorporate && employeeId.trim() ? ` or employee ID (${employeeId.trim()})` : ''}.
            </AppText>
          </Card>
          <TextField
            testID="register-password"
            label="Password"
            hint="At least 8 characters with a letter and a number"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <TextField
            testID="register-confirm"
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={createAccount}
          />
          <Button
            compact
            variant="ghost"
            label={showPassword ? 'Hide passwords' : 'Show passwords'}
            onPress={() => setShowPassword((v) => !v)}
            style={styles.toggle}
          />
          <Button testID="create-account" label="Create account" onPress={createAccount} loading={busy} />
          <AppText variant="caption" color={colors.textMuted} align="center">
            By creating an account you agree to our{' '}
            <AppText
              variant="caption"
              color={colors.primary}
              accessibilityRole="link"
              onPress={() => void WebBrowser.openBrowserAsync(getEnv().termsUrl)}
            >
              Terms
            </AppText>{' '}
            and{' '}
            <AppText
              variant="caption"
              color={colors.primary}
              accessibilityRole="link"
              onPress={() => void WebBrowser.openBrowserAsync(getEnv().privacyPolicyUrl)}
            >
              Privacy Policy
            </AppText>
            .
          </AppText>
        </>
      ) : null}

      {formError ? (
        <View style={styles.formError}>
          <AppText testID="register-error" color={colors.danger} accessibilityLiveRegion="assertive">
            {formError.message}
          </AppText>
          {formError.signIn ? (
            <Button
              testID="register-sign-in-instead"
              compact
              variant="outline"
              label="Sign in instead"
              onPress={() => router.replace('/sign-in')}
              style={styles.toggle}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  progress: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  progressBar: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  progressDone: { backgroundColor: colors.teal },
  toggle: { alignSelf: 'flex-start' },
  formError: { gap: spacing.sm },
});
