import { StyleSheet, View } from 'react-native';

import { FeatureRow, type FeatureRowProps } from '@/components/molecules';

export type FeatureListProps = {
  items: FeatureRowProps[];
};

export function FeatureList({ items }: FeatureListProps) {
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <FeatureRow key={item.text} {...item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 22,
  },
});
