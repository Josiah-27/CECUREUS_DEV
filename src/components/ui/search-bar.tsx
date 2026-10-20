import Search from 'lucide-react-native/icons/search';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type Props = Omit<TextInputProps, 'style'> & { label: string };

/** Rounded search pill from the design. */
export function SearchBar({ label, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <Search size={16} color={colors.textMuted} />
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  input: { ...typography.body, flex: 1, color: colors.text, paddingVertical: spacing.sm },
});
