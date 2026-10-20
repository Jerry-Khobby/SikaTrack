import { View } from 'react-native';

import { ProgressBar } from '@/components/atoms';
import { StatLine } from '@/components/molecules';
import { formatCount } from '@/utils/format';

export type SyncProgressProps = {
  found: number;
  parsed: number;
  ignored: number;
  total: number;
  done: boolean;
};

/** The first sync's progress bar and its live counts. */
export function SyncProgress({ found, parsed, ignored, total, done }: SyncProgressProps) {
  return (
    <View>
      <ProgressBar progress={total > 0 ? found / total : 1} accessibilityLabel="Sync progress" />
      <View className="mt-5 rounded-2xl bg-surface px-4 py-1.5">
        <StatLine label="Messages found" value={formatCount(found)} divider />
        <StatLine label={done ? 'Transactions' : 'Transactions so far'} value={formatCount(parsed)} divider />
        <StatLine label="Skipped (codes, promotions)" value={formatCount(ignored)} />
      </View>
    </View>
  );
}
