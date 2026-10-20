import { View } from 'react-native';

import { ThemedText, type IconName } from '@/components/atoms';

import { IconTile, type IconTone } from './icon-tile';

export type FeatureRowProps = {
  icon: IconName;
  tone: IconTone;
  text: string;
};

export function FeatureRow({ icon, tone, text }: FeatureRowProps) {
  return (
    <View className="flex-row items-start gap-4">
      <IconTile icon={icon} tone={tone} />
      <ThemedText className="flex-1 pt-0.5">{text}</ThemedText>
    </View>
  );
}
