import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/** Decorative artwork: hidden from screen readers on every platform (props on View, not Svg). */
function Decorative({ children }: { children: ReactNode }) {
  return (
    <View aria-hidden>
      {children}
    </View>
  );
}

/** Meditating figure from the Home hero (ported from the design SVG). */
export function HomeHeroIllustration({ size = 112 }: { size?: number }) {
  return (
    <Decorative>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="48" fill="#e0f7f7" />
        <Ellipse cx="50" cy="72" rx="22" ry="10" fill="#b2eaea" />
        <Circle cx="50" cy="38" r="16" fill="#17b8b0" opacity={0.3} />
        <Path d="M35 58 Q50 80 65 58" fill="#17b8b0" opacity={0.5} />
        <Circle cx="50" cy="40" r="12" fill="#17b8b0" opacity={0.6} />
        <Circle cx="74" cy="28" r="8" fill="#17b8b0" opacity={0.3} />
        <Path d="M42 38 Q50 46 58 38" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" />
      </Svg>
    </Decorative>
  );
}

/** Ally mascot (ported from the design SVG). */
export function AllyMascot({ size = 96 }: { size?: number }) {
  return (
    <Decorative>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="48" fill="#e0f7f7" />
        <Rect x="20" y="25" width="60" height="55" rx="30" fill="#17b8b0" opacity={0.8} />
        <Circle cx="38" cy="45" r="8" fill="white" />
        <Circle cx="62" cy="45" r="8" fill="white" />
        <Circle cx="38" cy="45" r="4" fill="#1a2b4a" />
        <Circle cx="62" cy="45" r="4" fill="#1a2b4a" />
        <Path d="M38 62 Q50 70 62 62" stroke="white" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Rect x="32" y="18" width="14" height="12" rx="3" fill="#17b8b0" />
        <Rect x="54" y="18" width="14" height="12" rx="3" fill="#17b8b0" />
        <Circle cx="50" cy="80" r="10" fill="#b2eaea" />
        <Path d="M44 80 Q50 76 56 80" stroke="white" strokeWidth={1.5} fill="none" />
      </Svg>
    </Decorative>
  );
}
