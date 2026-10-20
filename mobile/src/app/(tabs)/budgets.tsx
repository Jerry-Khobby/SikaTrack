import { View } from 'react-native';

import { EmptyState, ScreenTitle } from '@/components/molecules';
import { TabScreenTemplate } from '@/components/templates';

/** Placeholder for S23 · Budgets until it's built. */
export default function BudgetsScreen() {
  return (
    <TabScreenTemplate>
      <View className="px-4 pt-[18px]">
        <ScreenTitle title="Budgets" />
        <EmptyState
          icon="target"
          title="Budgets come next"
          message="Set a monthly limit per category and see how close you are to it."
        />
      </View>
    </TabScreenTemplate>
  );
}

