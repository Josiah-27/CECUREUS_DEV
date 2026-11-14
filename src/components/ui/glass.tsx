import { useId, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type SheenProps = {
  radius: number;
  /** "tinted" sits on a coloured fill; "light" sits on white or a pale fill. */
  tone?: 'tinted' | 'light';
};

/**
 * The lighting of a liquid-glass surface, laid over whatever fill the parent has:
 * a domed top-to-bottom gradient, a specular streak along the top edge and a bright inner rim.
 */
export function GlassSheen({ radius, tone = 'tinted' }: SheenProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const light = tone === 'light';
  return (
    <View pointerEvents="none" aria-hidden style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`dome${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={light ? 0.9 : 0.26} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#1A2B4A" stopOpacity={light ? 0.07 : 0.16} />
          </LinearGradient>
          <LinearGradient id={`spec${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={light ? 0.95 : 0.34} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#dome${id})`} />
        <Rect x="5%" y="5%" width="90%" height="38%" rx={999} fill={`url(#spec${id})`} />
      </Svg>
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.rim,
          { borderRadius: radius, borderColor: light ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.32)' },
        ]}
      />
    </View>
  );
}

const nativeDriver = Platform.OS !== 'web';

/** Press feedback that squashes like a drop of liquid and springs back. */
export function useLiquidPress() {
  const [press] = useState(() => new Animated.Value(0));
  const to = (toValue: number) =>
    Animated.spring(press, { toValue, useNativeDriver: nativeDriver, speed: 40, bounciness: toValue ? 0 : 14 }).start();
  return {
    onPressIn: () => to(1),
    onPressOut: () => to(0),
    style: {
      transform: [
        { scaleX: press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
        { scaleY: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] }) },
      ],
    },
  };
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  rim: { borderWidth: 1 },
});
