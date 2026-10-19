import { Pressable, StyleSheet } from 'react-native';

import { ControlHeight } from '@/theme';
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
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Icon name={icon} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: ControlHeight.touch,
    height: ControlHeight.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
