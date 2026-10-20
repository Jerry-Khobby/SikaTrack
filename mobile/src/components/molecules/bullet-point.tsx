import { View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type BulletPointProps = {
  icon: IconName;
  text: string;
};

/** A reassurance line with a green icon in front. */
export function BulletPoint({ icon, text }: BulletPointProps) {
  const theme = useTheme();

  return (
    <View className="flex-row items-start gap-[14px]">
      <View className="pt-px">
        <Icon name={icon} color={theme.iconGreen} size={20} />
      </View>
      <ThemedText type="none" className="flex-1 font-sans text-[15px] leading-[22px]">
        {text}
      </ThemedText>
    </View>
  );
}
