import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/atoms';
import { OfflineBanner } from '@/components/molecules';
import { useOffline } from '@/hooks/use-offline';
import { useTheme } from '@/hooks/use-theme';

type TabScreenTemplateProps = {
  /** Fixed at the top, above what scrolls. */
  header?: ReactNode;
  children: ReactNode;
  /**
   * `true` (default): the content scrolls, with pull-to-refresh.
   * `false`: the content brings its own list, e.g. a SectionList.
   */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Floats over the bottom-right of the content, e.g. "+ New budget". */
  floating?: ReactNode;
};

/** One tab's page: safe area at the top, the tab bar below, and the content between. */
export function TabScreenTemplate({ header, children, scroll = true, refreshing, onRefresh, floating }: TabScreenTemplateProps) {
  const theme = useTheme();
  const offline = useOffline();

  return (
    <ThemedView className="flex-1 flex-row justify-center">
      <SafeAreaView edges={['top', 'left', 'right']} className="max-w-content flex-1">
        {offline && <OfflineBanner />}
        {header}
        {scroll ? (
          <ScrollView
            contentContainerClassName={floating ? 'pb-24' : 'pb-6'}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.text} />
              ) : undefined
            }>
            {children}
          </ScrollView>
        ) : (
          <View className="flex-1">{children}</View>
        )}
        {floating && <View className="absolute bottom-4 right-4">{floating}</View>}
      </SafeAreaView>
    </ThemedView>
  );
}
