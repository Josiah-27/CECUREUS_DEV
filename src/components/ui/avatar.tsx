import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { AppText } from './app-text';

export function initialsOf(name: string): string {
  const words = name
    .replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ name, uri, size = 56 }: { name: string; uri?: string | null; size?: number }) {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[dims, styles.image]}
        contentFit="cover"
        accessibilityLabel={`Photo of ${name}`}
        transition={150}
      />
    );
  }
  return (
    <View style={[dims, styles.fallback]} accessible accessibilityLabel={`${name} initials`}>
      <AppText variant="subheading" color={colors.primary}>
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface },
  fallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
