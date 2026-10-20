import { View } from 'react-native';

import { EmptyState, ScreenTitle } from '@/components/molecules';
import { TabScreenTemplate } from '@/components/templates';

/** Placeholder for S25 · More until it's built. */
export default function MoreScreen() {
  return (
    <TabScreenTemplate>
      <View className="px-4 pt-[18px]">
        <ScreenTitle title="More" />
        <EmptyState
          icon="dots"
          title="More comes next"
          message="Wallets and balances, recurring payments, sync status, notification settings and your account will live here."
        />
      </View>
    </TabScreenTemplate>
  );
}

