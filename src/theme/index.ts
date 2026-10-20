/**
 * CecureUs design tokens, from the Figma Make prototype ("Build Prototype").
 *
 * Accessibility note: white text on the design teal (#17B8B0) is only 2.5:1, so
 * buttons and teal-coloured text use `primary` (#0E847E, 4.5:1). The exact design
 * teal is used for icons, borders, selection states and brand marks.
 */
export const colors = {
  // Brand (exact design values)
  teal: '#17B8B0',
  amber: '#F59E0B',
  navy: '#1A2B4A',
  tealLight: '#E0F7F7',
  amberLight: '#FFF7ED',

  // Semantic
  primary: '#0E847E',
  primaryPressed: '#0B6B66',
  primarySoft: '#E0F7F7',
  text: '#1A2B4A',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',
  screen: '#F8FAFB',
  background: '#FFFFFF',
  surface: '#F1F5F9',
  border: '#E5E7EB',
  borderSubtle: '#F1F3F5',

  emergency: '#B91C1C',
  emergencyIcon: '#EF4444',
  emergencySoft: '#FFF3F0',
  emergencyIconBg: '#FEE2E2',

  danger: '#B42318',
  dangerSoft: '#FEF3F2',
  success: '#067647',
  successSoft: '#ECFDF3',
  online: '#22C55E',
  warning: '#B54708',
  star: '#FACC15',
  overlay: 'rgba(26, 43, 74, 0.45)',

  accentPurple: '#8B5CF6',
  accentGreen: '#10B981',
  accentOrange: '#F97316',
} as const;

/** Rotating accent colours used by the design for avatars and stat cards. */
export const accentCycle = [colors.teal, colors.amber, colors.accentPurple, colors.accentGreen, colors.accentOrange];

export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  extrabold: 'Nunito_800ExtraBold',
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const typography = {
  brand: { fontSize: 36, lineHeight: 44, fontFamily: fonts.extrabold },
  display: { fontSize: 24, lineHeight: 31, fontFamily: fonts.bold },
  title: { fontSize: 20, lineHeight: 26, fontFamily: fonts.bold },
  heading: { fontSize: 16, lineHeight: 22, fontFamily: fonts.bold },
  subheading: { fontSize: 15, lineHeight: 21, fontFamily: fonts.bold },
  body: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 14, lineHeight: 21, fontFamily: fonts.bold },
  caption: { fontSize: 12, lineHeight: 17, fontFamily: fonts.regular },
  label: { fontSize: 12, lineHeight: 17, fontFamily: fonts.semibold },
  micro: { fontSize: 11, lineHeight: 15, fontFamily: fonts.semibold },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (Android guideline 48dp). */
export const TOUCH_TARGET = 48;

export const shadow = {
  card: {
    shadowColor: '#1A2B4A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  raised: {
    shadowColor: '#1A2B4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
} as const;
