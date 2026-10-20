import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type CardProps = {
  children: ReactNode;
  /** Makes the whole card one button. */
  onPress?: () => void;
  accessibilityLabel?: string;
  padding?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** A white rounded surface on the page background. */
export function Card({ children, onPress, accessibilityLabel, padding = 16, radius = 20, style }: CardProps) {
  const theme = useTheme();
  const base = { backgroundColor: theme.surface, borderRadius: radius, padding };

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
