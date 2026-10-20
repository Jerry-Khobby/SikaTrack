import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

export type CardProps = {
  children: ReactNode;
  /** Makes the whole card one button. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** 16 px all round (`p-4`). Turn off to set the padding in `className`. */
  padded?: boolean;
  radius?: number;
  /** Extra classes, e.g. `mt-3`, `overflow-hidden` or a padding with `padded={false}`. */
  className?: string;
};

/** A white rounded surface on the page background. */
export function Card({ children, onPress, accessibilityLabel, padded = true, radius = 20, className }: CardProps) {
  const classes = `bg-surface ${padded ? 'p-4' : ''} ${className ?? ''}`;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        className={`${classes} active:opacity-[0.85]`}
        style={{ borderRadius: radius }}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={classes} style={{ borderRadius: radius }}>
      {children}
    </View>
  );
}
