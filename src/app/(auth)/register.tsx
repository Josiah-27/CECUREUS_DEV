import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, friendlyMessage } from '@/api/errors';
import { userTypeSchema, type OtpRequest, type RegistrationRequest } from '@/api/schemas';
import { useAuth } from '@/auth/auth-provider';
import { OtpEntry } from '@/components/otp-entry';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { getEnv } from '@/config/env';
import { openWhatsApp } from '@/lib/contact';
import { registrationMessage, validateCompanyName } from '@/lib/registration';
import {
  formatIndianMobile,
  normalizeIndianMobile,
  validateEmail,
  validateEmployeeId,
  validateName,
} from '@/lib/validation';
import { useApi } from '@/providers/api-provider';
import { colors, radius, spacing } from '@/theme';

const STEP_TITLES = ['Your details', 'Verify your number'];

/**
 * New account: the person fills in their details and proves they hold the mobile number with an
 * SMS code. The app then adds them to employee_list, signs them in, and opens WhatsApp with the
 * same details so the CecureUs team knows a new person has joined.
 */
export default function RegisterScreen() {
  const params = useLocalSearchParams<{ userType?: string }>();
  const userType = userTypeSchema.catch('individual').parse(params.userType);
  const isCorporate = userType === 'corporate';

  const api = useApi();
  const { verifyOtp } = useAuth();
  const [otp, setOtp] = useState<OtpRequest | null>(null);
  const [error, setError] = useState<{ message: string; signIn: boolean } | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileInput, setMobileInput] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [request, setRequest] = useState<RegistrationRequest | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(r: RegistrationRequest) {
    setBusy(true);
    setError(null);
    try {
      setOtp(await api.auth.register(r));
    } catch (e) {
      const message =
        e instanceof ApiError && e.kind === 'rate_limited' && e.retryAfterSeconds
          ? `Please wait ${e.retryAfterSeconds} seconds before requesting another code.`
          : friendlyMessage(e);
      setError({ message, signIn: e instanceof ApiError && e.code === 'ALREADY_REGISTERED' });
    } finally {
      setBusy(false);
    }
  }

  /** Creates the account and signs in; then tells the CecureUs team on WhatsApp. */
  async function verify(r: RegistrationRequest, requestId: string, code: string) {
    await verifyOtp(requestId, code);
    // The account already exists at this point, so a problem opening WhatsApp must not undo it.
    void openWhatsApp(registrationMessage(r)).catch(() => undefined);
  }

  function submit() {
    const phone = normalizeIndianMobile(mobileInput);
    const next = {
      firstName: validateName(firstName, 'First name'),
      lastName: lastName.trim() ? validateName(lastName, 'Last name') : null,
      email: validateEmail(email),
      mobile: phone.value ? null : (phone.error ?? 'Enter your mobile number.'),
      companyName: isCorporate ? validateCompanyName(companyName) : null,
      employeeId: isCorporate ? validateEmployeeId(employeeId) : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !phone.value) return;
    const r: RegistrationRequest = {
      userType,
      firstName: firstName.trim(),
      lastName: lastName.trim() || null,
      email: email.trim().toLowerCase(),
      mobile: phone.value,
      companyName: isCorporate ? companyName.trim() : null,
      employeeId: isCorporate && employeeId.trim() ? employeeId.trim() : null,
    };
    setRequest(r);
    void send(r);
  }

  const verifying = !!otp && !!request;
  const current = verifying ? 2 : 1;

  return (
    <Screen edges={['bottom']} testID="register-screen">
      <View style={styles.header}>
        <AppText variant="display">{isCorporate ? 'Corporate sign up' : 'Create your account'}</AppText>
        <AppText variant="caption" color={colors.textMuted} testID="register-step">
          Step {current} of 2 · {STEP_TITLES[current - 1]}
        </AppText>
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 2, now: current }}>
          {STEP_TITLES.map((t, i) => (
            <View key={t} style={[styles.progressBar, i < current && styles.progressDone]} />
          ))}
        </View>
      </View>

      {!verifying ? (
        <>
          <AppText color={colors.textMuted}>
            {isCorporate
              ? 'Tell us who you are and where you work. We will send a code to your mobile number to confirm it is yours.'
              : 'Tell us a little about yourself. We will send a code to your mobile number to confirm it is yours.'}
          </AppText>
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
          <TextField
            testID="register-mobile"
            label="Mobile number"
            hint="You will sign in with this number"
            placeholder="10-digit mobile number"
            value={mobileInput}
            onChangeText={setMobileInput}
            error={errors.mobile}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
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
          />
          {isCorporate ? (
            <>
              <TextField
                testID="register-company"
                label="Company name"
                value={companyName}
                onChangeText={setCompanyName}
                error={errors.companyName}
                autoComplete="organization"
                textContentType="organizationName"
              />
              <TextField
                testID="register-employee-id"
                label="Employee ID (optional)"
                hint="Helps our team find you in your company's list"
                value={employeeId}
                onChangeText={setEmployeeId}
                error={errors.employeeId}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </>
          ) : null}
          {error ? (
            <AppText testID="register-error" color={colors.danger} accessibilityLiveRegion="assertive">
              {error.message}
            </AppText>
          ) : null}
          {error?.signIn ? (
            <Button testID="register-go-sign-in" variant="outline" label="Go to sign in" onPress={() => router.replace('/sign-in')} />
          ) : null}
          <Button testID="register-send" label="Create account" onPress={submit} loading={busy} />
          <AppText variant="caption" color={colors.textMuted} align="center">
            After your number is confirmed, WhatsApp opens so you can send your details to the CecureUs team. By
            creating an account you agree to our{' '}
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

      {otp && request ? (
        <>
          <Card tone="soft" testID="register-verify">
            <AppText variant="caption" color={colors.textMuted}>
              Your account is created as soon as you enter the code. WhatsApp then opens with your details for the
              CecureUs team — tap Send there.
            </AppText>
          </Card>
          <OtpEntry
            key={otp.requestId}
            destination={formatIndianMobile(request.mobile)}
            initial={otp}
            // On success the auth guard swaps to the signed-in app automatically.
            onVerify={(requestId, code) => verify(request, requestId, code)}
            onResend={() => api.auth.register(request)}
            onChangeDestination={() => {
              setOtp(null);
              setError(null);
            }}
            changeLabel="Edit my details"
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  progress: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  progressBar: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  progressDone: { backgroundColor: colors.teal },
});
