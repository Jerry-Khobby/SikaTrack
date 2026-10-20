import { View } from 'react-native';

import { Card, Icon, ThemedText, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

import { IconTile } from './icon-tile';

export type NavigationRowProps = {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
};

/** A card that's one tappable line, e.g. the recurring-payments strip. */
export function NavigationRow({ icon, title, subtitle, onPress }: NavigationRowProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} accessibilityLabel={`${title}, ${subtitle}`} radius={18} padded={false} className="p-[14px]">
      <View className="flex-row items-center gap-3">
        <IconTile icon={icon} size={40} />
        <View className="min-w-0 flex-1">
          <ThemedText type="none" className="font-sans-extrabold text-[15px] leading-[21px]">
            {title}
          </ThemedText>
          <ThemedText type="fine" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
        <Icon name="chevron-right" color={theme.text} size={18} />
      </View>
    </Card>
  );
}
