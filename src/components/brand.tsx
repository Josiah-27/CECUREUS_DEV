import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

const mark = require('../../assets/images/logo-mark.png');
const MARK_RATIO = 155 / 199;

/** The CecureUs "S" mark (official artwork). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={mark}
      style={{ height: size, width: size * MARK_RATIO }}
      contentFit="contain"
      accessibilityLabel="CecureUs"
      accessibilityRole="image"
    />
  );
}

/** "Cecure" in teal + "Us" in amber, as in the design. */
export function BrandName({ size = 20 }: { size?: number }) {
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="CecureUs"
      style={{ fontFamily: fonts.extrabold, fontSize: size, lineHeight: size * 1.25 }}
    >
      <Text style={{ color: colors.teal }}>Cecure</Text>
      <Text style={{ color: colors.amber }}>Us</Text>
    </Text>
  );
}

export function BrandLockup({ size = 20 }: { size?: number }) {
  return (
    <View style={styles.lockup}>
      <LogoMark size={size * 1.4} />
      <BrandName size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
