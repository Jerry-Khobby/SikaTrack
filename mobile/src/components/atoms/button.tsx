import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { BrandColors, ControlHeight, FontFamily, Radius } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * `primary`: filled, the screen's main action. `secondary`: outlined.
   * `accent`: gold, for the brand-ink screens. `link`: text only.
   */
  variant?: 'primary' | 'secondary' | 'accent' | 'link';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const look = {
    primary: { background: theme.primary, border: undefined, label: theme.onPrimary },
    secondary: { background: undefined, border: theme.primary, label: theme.primary },
    accent: { background: BrandColors.gold, border: undefined, label: BrandColors.ink },
    link: { background: undefined, border: undefined, label: theme.link },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        variant === 'link' ? styles.link : styles.filled,
        look.background !== undefined && { backgroundColor: look.background },
        look.border !== undefined && { borderWidth: 1.5, borderColor: look.border },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={look.label} />
      ) : (
        <Text
          style={[
            variant === 'link' ? styles.linkLabel : styles.filledLabel,
            variant === 'accent' && styles.accentLabel,
            { color: look.label },
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filled: {
    height: ControlHeight.button,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    height: ControlHeight.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },
  accentLabel: {
    fontFamily: FontFamily.extraBold,
  },
  linkLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
});
