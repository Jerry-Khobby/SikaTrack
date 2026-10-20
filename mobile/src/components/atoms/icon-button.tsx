import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

export type IconButtonProps = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
};

export function IconButton({ icon, accessibilityLabel, onPress }: IconButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      className="h-touch w-touch items-center justify-center active:opacity-60">
      <Icon name={icon} color={theme.text} />
    </Pressable>
  );
}
