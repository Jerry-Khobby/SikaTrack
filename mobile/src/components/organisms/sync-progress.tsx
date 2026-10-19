import { StyleSheet, View } from 'react-native';

import { ProgressBar } from '@/components/atoms';
import { StatLine } from '@/components/molecules';
import { Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();

  return (
    <View>
      <ProgressBar progress={total > 0 ? found / total : 1} accessibilityLabel="Sync progress" />
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <StatLine label="Messages found" value={formatCount(found)} divider />
        <StatLine
          label={done ? 'Transactions' : 'Transactions so far'}
          value={formatCount(parsed)}
          divider
        />
        <StatLine label="Skipped (codes, promotions)" value={formatCount(ignored)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    paddingVertical: 6,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
  },
});
