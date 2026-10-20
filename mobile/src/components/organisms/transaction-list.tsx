import type { ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, View } from 'react-native';

import { DayHeader, TransactionRow } from '@/components/molecules';
import { useTheme } from '@/hooks/use-theme';
import type { Transaction } from '@/services/transactions';
import { formatTime } from '@/utils/dates';
import type { DaySection } from '@/utils/group-by-day';

export type TransactionListProps = {
  sections: DaySection[];
  providerNames: Record<string, string>;
  onPressTransaction: (id: string) => void;
  /** Asks for the next page as the end comes into view. */
  onEndReached?: () => void;
  loadingMore?: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  ListEmptyComponent?: ReactElement;
};

/** Every payment, grouped by day under sticky headers, loading more as it scrolls. */
export function TransactionList({
  sections,
  providerNames,
  onPressTransaction,
  onEndReached,
  loadingMore,
  refreshing,
  onRefresh,
  ListEmptyComponent,
}: TransactionListProps) {
  const theme = useTheme();

  return (
    <SectionList<Transaction, DaySection>
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled
      renderSectionHeader={({ section }) => <DayHeader title={section.title} total={section.total} />}
      renderItem={({ item, index, section }) => {
        const first = index === 0;
        const last = index === section.data.length - 1;
        return (
          <View
            className={`mx-4 overflow-hidden bg-surface ${first ? 'rounded-t-lg' : ''} ${last ? 'rounded-b-lg' : ''}`}>
            <TransactionRow
              transaction={item}
              providerName={providerNames[item.provider] ?? item.provider}
              timeLabel={formatTime(item.occurredAt)}
              onPress={() => onPressTransaction(item.id)}
              divider={!last}
            />
          </View>
        );
      }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" color={theme.text} /> : undefined}
      contentContainerClassName="grow pb-4"
      showsVerticalScrollIndicator={false}
    />
  );
}
