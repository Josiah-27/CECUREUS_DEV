import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Screen } from '@/components/ui';
import { getEnv } from '@/config/env';
import { colors, spacing } from '@/theme';

const CAN_SEE = ['Aggregate & anonymous usage analytics', 'Overall programme utilisation and engagement'];
const CANNOT_SEE = ['Counselling conversations', 'Journal entries', 'Assessment answers and scores', 'Session notes or recordings', 'Which counsellor you booked'];

export default function PrivacyScreen() {
  return (
    <Screen edges={['bottom']}>
      <AppText>
        CecureUs follows strict confidentiality standards. Your conversations and personal information are safe with us.
      </AppText>

      <Card>
        <AppText variant="subheading">Your employer / HR can see</AppText>
        {CAN_SEE.map((t) => (
          <Row key={t} icon="checkmark-circle" color={colors.success} text={t} />
        ))}
      </Card>

      <Card>
        <AppText variant="subheading">Your employer / HR can never see</AppText>
        {CANNOT_SEE.map((t) => (
          <Row key={t} icon="close-circle" color={colors.danger} text={t} />
        ))}
      </Card>

      <Card tone="soft">
        <AppText variant="subheading">On this device</AppText>
        <AppText variant="caption">
          Your journal, mood check-ins and goals are encrypted and stored only on this phone. They are removed if you
          delete your account or uninstall the app.
        </AppText>
      </Card>

      <Button variant="outline" label="Read full Privacy Policy" onPress={() => void WebBrowser.openBrowserAsync(getEnv().privacyPolicyUrl)} />
    </Screen>
  );
}

function Row({ icon, color, text }: { icon: 'checkmark-circle' | 'close-circle'; color: string; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={color} />
      <AppText style={styles.flex}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  flex: { flex: 1 },
});
