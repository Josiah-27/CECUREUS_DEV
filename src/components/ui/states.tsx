import CloudOff from 'lucide-react-native/icons/cloud-off';
import Leaf from 'lucide-react-native/icons/leaf';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { friendlyMessage } from '@/api/errors';
import { colors, spacing } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.teal} />
      <AppText variant="caption" color={colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center} testID="error-state">
      <CloudOff size={40} color={colors.textMuted} />
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
  Icon = Leaf,
  action,
}: {
  title: string;
  message?: string;
  Icon?: LucideIcon;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center} testID="empty-state">
      <View style={styles.iconWrap}>
        <Icon size={28} color={colors.teal} />
      </View>
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
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.tealLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
