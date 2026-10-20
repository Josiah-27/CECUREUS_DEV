import { useState } from 'react';
import { Alert } from 'react-native';

import { friendlyMessage } from '@/api/errors';
import { useAuth } from '@/auth/auth-provider';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { goBackOr } from '@/lib/navigation';
import { normalizeIndianMobile, validateName } from '@/lib/validation';
import { useApi } from '@/providers/api-provider';
import { colors } from '@/theme';

export default function EditProfileScreen() {
  const { user, updateUser } = useAuth();
  const api = useApi();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [mobile, setMobile] = useState(user?.mobile ?? '');
  const [errors, setErrors] = useState<{ firstName?: string | null; lastName?: string | null; mobile?: string | null }>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function save() {
    const phone = normalizeIndianMobile(mobile);
    const next = {
      firstName: validateName(firstName, 'First name'),
      lastName: lastName.trim() ? validateName(lastName, 'Last name') : null,
      mobile: phone.error,
    };
    setErrors(next);
    if (next.firstName || next.lastName || next.mobile) return;
    setSaving(true);
    setServerError(null);
    try {
      const updated = await api.profile.update({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        mobile: phone.value,
      });
      await updateUser(updated);
      Alert.alert('Profile updated', 'Your profile was updated successfully.');
      goBackOr('/profile');
    } catch (e) {
      setServerError(friendlyMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen edges={['bottom']} footer={<Button testID="save-profile" label="Save Changes" onPress={() => void save()} loading={saving} />}>
      <TextField testID="first-name" label="First name" value={firstName} onChangeText={setFirstName} error={errors.firstName} autoComplete="given-name" />
      <TextField label="Last name" value={lastName} onChangeText={setLastName} error={errors.lastName} autoComplete="family-name" />
      <TextField
        testID="mobile"
        label="Mobile number (optional)"
        value={mobile}
        onChangeText={setMobile}
        error={errors.mobile}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="98765 43210"
      />
      <TextField label="Email" value={user?.email ?? ''} editable={false} hint="Your sign-in email cannot be changed here. Contact support to update it." />
      {serverError ? (
        <AppText color={colors.danger} accessibilityLiveRegion="assertive">
          {serverError}
        </AppText>
      ) : null}
    </Screen>
  );
}
