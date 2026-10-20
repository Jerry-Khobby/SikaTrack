import { ActivityIndicator, Pressable, Text } from 'react-native';

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

const LOOK = {
  primary: { box: 'h-button rounded-md bg-primary', label: 'font-sans-bold text-base text-on-primary' },
  secondary: {
    box: 'h-button rounded-md border-[1.5px] border-primary',
    label: 'font-sans-bold text-base text-primary',
  },
  accent: { box: 'h-button rounded-md bg-brand-gold', label: 'font-sans-extrabold text-base text-brand-ink' },
  link: { box: 'h-touch', label: 'font-sans-semibold text-[15px] text-link' },
};

export function Button({ label, onPress, variant = 'primary', disabled, loading }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const look = LOOK[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={`items-center justify-center ${look.box} ${disabled ? 'opacity-40' : ''} active:opacity-80`}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.onPrimary : theme.text} />
      ) : (
        <Text className={look.label}>{label}</Text>
      )}
    </Pressable>
  );
}
