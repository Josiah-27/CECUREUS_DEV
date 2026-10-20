import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { accentCycle, colors, fonts } from '@/theme';

import { AppText } from './app-text';

export function initialsOf(name: string): string {
  const words = name
    .replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?';
}

/** Stable accent colour for a name, so the same person always gets the same avatar colour. */
export function accentFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return accentCycle[hash % accentCycle.length];
}

export function Avatar({
  name,
  uri,
  size = 56,
  color,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  color?: string;
}) {
  const dims = { width: size, height: size, borderRadius: size / 2 };
  // A broken or unreachable photo falls back to coloured initials instead of a blank circle.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (uri && failedUri !== uri) {
    return (
      <Image
        source={{ uri }}
        style={[dims, styles.image]}
        contentFit="cover"
        accessibilityLabel={`Photo of ${name}`}
        transition={150}
        onError={() => setFailedUri(uri)}
      />
    );
  }
  return (
    <View
      style={[dims, styles.fallback, { backgroundColor: color ?? accentFor(name) }]}
      accessible
      accessibilityLabel={`${name} initials`}
    >
      <AppText style={{ fontFamily: fonts.bold, fontSize: size * 0.36, lineHeight: size * 0.46 }} color="#FFFFFF">
        {initialsOf(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surface },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
