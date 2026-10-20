import { View } from 'react-native';

import { ThemedText, type IconName } from '@/components/atoms';

import { IconTile } from './icon-tile';

export type InfoCardProps = {
  icon: IconName;
  title: string;
  body: string;
};

export function InfoCard({ icon, title, body }: InfoCardProps) {
  return (
    <View className="flex-row gap-[14px] rounded-lg bg-surface p-[18px]">
      <IconTile icon={icon} size={40} />
      <View className="flex-1 gap-1.5">
        <ThemedText type="subheading" accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText type="callout" themeColor="textBody">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}
