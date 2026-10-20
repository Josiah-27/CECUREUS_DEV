import { Image } from 'expo-image';

const full = require('../../assets/images/logo-full.png');
const mark = require('../../assets/images/logo-mark.png');

export function Logo({ variant = 'full', height = 36 }: { variant?: 'full' | 'mark'; height?: number }) {
  // Aspect ratios of the supplied artwork.
  const ratio = variant === 'full' ? 378 / 293 : 155 / 199;
  return (
    <Image
      source={variant === 'full' ? full : mark}
      style={{ height, width: height * ratio }}
      contentFit="contain"
      accessibilityLabel="CecureUs"
      accessibilityRole="image"
    />
  );
}
