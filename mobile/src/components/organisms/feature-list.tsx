import { View } from 'react-native';

import { FeatureRow, type FeatureRowProps } from '@/components/molecules';

export type FeatureListProps = {
  items: FeatureRowProps[];
};

export function FeatureList({ items }: FeatureListProps) {
  return (
    <View className="gap-[22px]">
      {items.map((item) => (
        <FeatureRow key={item.text} {...item} />
      ))}
    </View>
  );
}
