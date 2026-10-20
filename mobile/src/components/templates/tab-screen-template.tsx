import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/atoms';
import { MaxContentWidth } from '@/theme';
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
};

/** One tab's page: safe area at the top, the tab bar below, and the content between. */
export function TabScreenTemplate({ header, children, scroll = true, refreshing, onRefresh }: TabScreenTemplateProps) {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={theme.text} />
              ) : undefined
            }>
            {children}
          </ScrollView>
        ) : (
          <View style={styles.flex}>{children}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
});
