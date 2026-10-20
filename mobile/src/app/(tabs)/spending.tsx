import { View } from 'react-native';

import { EmptyState, ScreenTitle } from '@/components/molecules';
import { TabScreenTemplate } from '@/components/templates';

/** Placeholder for S17 · Spending until it's built. */
export default function SpendingScreen() {
  return (
    <TabScreenTemplate>
      <View className="px-4 pt-[18px]">
        <ScreenTitle title="Spending" />
        <EmptyState
          icon="pie-chart"
          title="Spending comes next"
          message="Categories, trends, habits, the people you pay and your fees will live here."
        />
      </View>
    </TabScreenTemplate>
  );
}

