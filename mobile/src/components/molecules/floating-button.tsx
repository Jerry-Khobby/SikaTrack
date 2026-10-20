import { Pressable, Text } from 'react-native';

import { Icon, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type FloatingButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
};

/** A raised shadow under the button (native shadow props have no Tailwind class). */
const LIFT = {
  elevation: 6,
  shadowColor: '#1B2631',
  shadowOpacity: 0.3,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
};

/** The screen's main action, floating above the content, e.g. "+ New budget". */
export function FloatingButton({ icon, label, onPress }: FloatingButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-14 flex-row items-center gap-2 rounded-lg bg-primary px-5 active:opacity-90"
      style={LIFT}>
      <Icon name={icon} color={theme.onPrimary} size={20} />
      <Text className="font-sans-bold text-[15px] text-on-primary">{label}</Text>
    </Pressable>
  );
}
