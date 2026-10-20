import { useState } from 'react';
import { Alert } from 'react-native';

import { friendlyMessage } from '@/api/errors';
import { useAuth } from '@/auth/auth-provider';
import { AppText, Button, Card, Screen, TextField } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/config/constants';
import { clearAllLocalData } from '@/local/stores';
import { useApi } from '@/providers/api-provider';
import { colors } from '@/theme';

const CONFIRM_WORD = 'DELETE';

/** In-app account deletion (Google Play requirement). */
export default function DeleteAccountScreen() {
  const api = useApi();
  const { signOut } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      await api.profile.requestDeletion();
      await clearAllLocalData();
      Alert.alert(
        'Account deletion requested',
        'Your account and personal data will be deleted. You will receive a confirmation email.',
      );
      await signOut();
    } catch (e) {
      setError(friendlyMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']}>
      <AppText variant="title">Delete your account</AppText>
      <AppText>Deleting your account will:</AppText>
      <Card>
        <AppText>• Permanently delete your profile and sign-in details</AppText>
        <AppText>• Cancel any upcoming sessions</AppText>
        <AppText>• Remove your journal, moods and goals from this device</AppText>
      </Card>
      <AppText variant="caption" color={colors.textMuted}>
        Some records (for example, booking and invoice records) may be retained for the period required by law, as
        described in our Privacy Policy. Questions? Email {SUPPORT_EMAIL}.
      </AppText>
      <TextField
        testID="delete-confirm"
        label={`Type ${CONFIRM_WORD} to confirm`}
        value={confirm}
        onChangeText={setConfirm}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {error ? <AppText color={colors.danger}>{error}</AppText> : null}
      <Button
        testID="delete-account"
        variant="danger"
        label="Delete my account"
        disabled={confirm.trim().toUpperCase() !== CONFIRM_WORD}
        loading={busy}
        onPress={() => void deleteAccount()}
      />
    </Screen>
  );
}
