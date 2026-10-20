import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { friendlyMessage } from '@/api/errors';
import { colors, spacing } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center} testID="error-state">
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
      <AppText variant="body" align="center" accessibilityLiveRegion="polite">
        {friendlyMessage(error)}
      </AppText>
      {onRetry ? <Button label="Try again" variant="outline" compact onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon = 'leaf-outline',
  action,
}: {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center} testID="empty-state">
      <Ionicons name={icon} size={40} color={colors.primary} />
      <AppText variant="subheading" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" align="center" color={colors.textMuted}>
          {message}
        </AppText>
      ) : null}
      {action ? <Button label={action.label} variant="outline" compact onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
});
