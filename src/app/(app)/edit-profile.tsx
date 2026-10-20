import { useState } from 'react';
import { Alert } from 'react-native';

import { friendlyMessage } from '@/api/errors';
import { useAuth } from '@/auth/auth-provider';
import { AppText, Button, Screen, TextField } from '@/components/ui';
import { MAX_AGE, MIN_AGE, parseAge, validateName } from '@/lib/validation';
import { goBackOr } from '@/lib/navigation';
import { useApi } from '@/providers/api-provider';
import { colors } from '@/theme';

export default function EditProfileScreen() {
  const { user, updateUser } = useAuth();
  const api = useApi();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [age, setAge] = useState(user?.age != null ? String(user.age) : '');
  const [errors, setErrors] = useState<{ firstName?: string | null; lastName?: string | null; age?: string | null }>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  async function save() {
    const parsedAge = parseAge(age);
    const next = {
      firstName: validateName(firstName, 'First name'),
      lastName: lastName.trim() ? validateName(lastName, 'Last name') : null,
      age: parsedAge.error,
    };
    setErrors(next);
    if (next.firstName || next.lastName || next.age) return;
    setSaving(true);
    setServerError(null);
    try {
      const updated = await api.profile.update({
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        age: parsedAge.value,
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
    <Screen
      edges={['bottom']}
      footer={<Button testID="save-profile" label="Save Changes" onPress={() => void save()} loading={saving} />}
    >
      <TextField
        testID="first-name"
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        error={errors.firstName}
        autoComplete="given-name"
      />
      <TextField
        testID="last-name"
        label="Last name"
        value={lastName}
        onChangeText={setLastName}
        error={errors.lastName}
        autoComplete="family-name"
      />
      <TextField
        testID="age"
        label="Age (optional)"
        hint={`In years · ${MIN_AGE}–${MAX_AGE}`}
        value={age}
        onChangeText={(t) => setAge(t.replace(/\D/g, '').slice(0, 3))}
        error={errors.age}
        keyboardType="number-pad"
        maxLength={3}
        placeholder="e.g. 29"
      />
      <TextField
        label="Email"
        value={user?.email ?? ''}
        editable={false}
        hint="Verified at sign-up. Contact support to change it."
      />
      <TextField
        label="Mobile number"
        value={user?.mobile ?? ''}
        editable={false}
        hint="Verified at sign-up. Contact support to change it."
      />
      {serverError ? (
        <AppText color={colors.danger} accessibilityLiveRegion="assertive">
          {serverError}
        </AppText>
      ) : null}
    </Screen>
  );
}
