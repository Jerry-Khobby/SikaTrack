import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { ControlHeight, FontFamily, Radius } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'link';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        isPrimary ? styles.primary : styles.link,
        isPrimary && { backgroundColor: theme.primary },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.onPrimary : theme.link} />
      ) : (
        <Text
          style={[
            isPrimary ? styles.primaryLabel : styles.linkLabel,
            { color: isPrimary ? theme.onPrimary : theme.link },
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
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
  primaryLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },
  linkLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
});
