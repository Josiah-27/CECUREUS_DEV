import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

/** Shown only in demo mode so sample data is never mistaken for real data. */
export function DemoBadge() {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 76 }]} testID="demo-badge">
      <Text style={styles.text}>DEMO · sample data</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.amber,
    opacity: 0.9,
  },
  text: { fontFamily: fonts.bold, fontSize: 10, color: colors.navy },
});
