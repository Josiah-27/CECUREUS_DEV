/**
 * CecureUs design tokens, derived from the supplied app designs and logo.
 * Text/background pairs used for body text meet WCAG AA (4.5:1).
 */
export const colors = {
  brandBlue: '#0AA3D6',
  brandOrange: '#F59A00',
  primary: '#0F7C82', // teal CTA (white text ≈ 5:1)
  primaryPressed: '#0B6469',
  primarySoft: '#E6F4F4',
  emergency: '#C2410C', // orange-700, AA on white
  emergencySoft: '#FFF4EC',
  text: '#0D1B3E',
  textMuted: '#4B5568',
  textOnPrimary: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F6F9FB',
  border: '#E1E7EE',
  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  success: '#067647',
  successSoft: '#ECFDF3',
  warning: '#B54708',
  overlay: 'rgba(13, 27, 62, 0.45)',
  accentPurple: '#6E56CF',
  accentYellow: '#E5A000',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (Android guideline 48dp). */
export const TOUCH_TARGET = 48;

export const shadow = {
  card: {
    shadowColor: '#0D1B3E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
