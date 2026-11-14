import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { userTypeSchema, type RegistrationRequest } from '@/api/schemas';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { WHATSAPP_DISPLAY } from '@/config/constants';
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
import { colors, radius, spacing } from '@/theme';

type Step = 'details' | 'sent';
const STEP_TITLES = ['Your details', 'Send to CecureUs'];

/**
 * Account request: the person fills in their details, which are sent to the CecureUs team
 * on WhatsApp. The team verifies them and adds the person to employee_list; from then on
 * they sign in with their mobile number and an SMS code. Nothing is written to the backend here.
 */
export default function RegisterScreen() {
  const params = useLocalSearchParams<{ userType?: string }>();
  const userType = userTypeSchema.catch('individual').parse(params.userType);
  const isCorporate = userType === 'corporate';

  const [step, setStep] = useState<Step>('details');
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
    try {
      if (await openWhatsApp(registrationMessage(r))) setStep('sent');
    } finally {
      setBusy(false);
    }
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

  const current = step === 'details' ? 1 : 2;

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

      {step === 'details' ? (
        <>
          <AppText color={colors.textMuted}>
            {isCorporate
              ? 'Tell us who you are and where you work. Our team will check that your organisation is registered with CecureUs.'
              : 'Tell us a little about yourself. Our team will set up your account.'}
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
            placeholder="98765 43210"
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
          <Button testID="register-send" label="Send on WhatsApp" onPress={submit} loading={busy} />
          <AppText variant="caption" color={colors.textMuted} align="center">
            WhatsApp opens with your details filled in for {WHATSAPP_DISPLAY}. By sending them you agree to our{' '}
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

      {step === 'sent' && request ? (
        <>
          <Card tone="soft" testID="register-sent">
            <AppText variant="label" color={colors.primary}>
              ✓ Details ready to send
            </AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Make sure you tapped Send in WhatsApp. Our team will verify your details and set up your account,
              usually within one working day.
            </AppText>
          </Card>
          <AppText>
            Once your account is ready, sign in with {formatIndianMobile(request.mobile)}. We will send a code to that
            number by SMS.
          </AppText>
          <Button testID="register-go-sign-in" label="Go to sign in" onPress={() => router.replace('/sign-in')} />
          <Button
            testID="register-resend"
            variant="outline"
            label="Open WhatsApp again"
            onPress={() => void send(request)}
            loading={busy}
          />
          <Button
            testID="register-edit"
            variant="ghost"
            compact
            label="Edit my details"
            onPress={() => setStep('details')}
            style={styles.toggle}
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
  toggle: { alignSelf: 'flex-start' },
});
