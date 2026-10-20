import { View } from 'react-native';

import { Card } from '@/components/atoms';
import { SectionHeader, TransactionRow } from '@/components/molecules';
import type { Transaction } from '@/services/transactions';
import { formatDateTime } from '@/utils/dates';

export type RecentTransactionsCardProps = {
  transactions: Transaction[];
  providerNames: Record<string, string>;
  onPressTransaction: (id: string) => void;
  onSeeAll: () => void;
};

/** The latest few payments, the same rows as the Transactions tab. */
export function RecentTransactionsCard({
  transactions,
  providerNames,
  onPressTransaction,
  onSeeAll,
}: RecentTransactionsCardProps) {
  return (
    <Card padded={false} className="overflow-hidden py-1.5">
      <View className="px-4 pt-0.5">
        <SectionHeader title="Recent" actionLabel="See all" onAction={onSeeAll} />
      </View>
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          providerName={providerNames[transaction.provider] ?? transaction.provider}
          timeLabel={formatDateTime(transaction.occurredAt)}
          onPress={() => onPressTransaction(transaction.id)}
        />
      ))}
    </Card>
  );
}
