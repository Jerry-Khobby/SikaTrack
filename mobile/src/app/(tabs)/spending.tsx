import { StyleSheet, View } from 'react-native';

import { EmptyState, ScreenTitle } from '@/components/molecules';
import { TabScreenTemplate } from '@/components/templates';

/** Placeholder for S17 · Spending until it's built. */
export default function SpendingScreen() {
  return (
    <TabScreenTemplate>
      <View style={styles.page}>
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingHorizontal: 16,
  },
});
