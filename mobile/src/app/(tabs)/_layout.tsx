import { Tabs } from 'expo-router/js-tabs';

import type { IconName } from '@/components/atoms';
import { TabBar } from '@/components/organisms';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'transactions', label: 'Transactions', icon: 'list' },
  { name: 'spending', label: 'Spending', icon: 'pie-chart' },
  { name: 'budgets', label: 'Budgets', icon: 'target' },
  { name: 'more', label: 'More', icon: 'dots' },
];

/** The five main tabs (docs/ui-spec.md §2). */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigateToTab }) => (
        <TabBar
          items={state.routes.map((route, index) => {
            const tab = TABS.find((t) => t.name === route.name);
            return {
              key: route.key,
              label: tab?.label ?? route.name,
              icon: tab?.icon ?? 'dots',
              focused: state.index === index,
            };
          })}
          onPress={navigateToTab}
        />
      )}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
