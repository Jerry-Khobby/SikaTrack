import { View } from 'react-native';

import { ProgressBar, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type BudgetState = 'on_track' | 'warning' | 'over';

export type BudgetProgressProps = {
  name: string;
  /** E.g. `GHS 612.50 of 700`. */
  spent: string;
  /** Fraction of the limit used. */
  used: number;
  state: BudgetState;
};

const TEXT_CLASSES: Record<BudgetState, string> = {
  on_track: 'text-icon-success',
  warning: 'text-icon-amber',
  over: 'text-icon-red',
};

/** A budget's name, how much of it is spent, and a bar coloured by its status. */
export function BudgetProgress({ name, spent, used, state }: BudgetProgressProps) {
  const theme = useTheme();
  const bar = { on_track: theme.statusGood, warning: theme.statusWarning, over: theme.statusBad }[state];

  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between gap-3">
        <ThemedText type="none" className="shrink font-sans-bold text-[13px] leading-[18px]" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText
          type="none"
          themeColor="none"
          className={`font-sans-bold text-[13px] leading-[18px] ${TEXT_CLASSES[state]}`}
          style={{ fontVariant: ['tabular-nums'] }}>
          {spent}
        </ThemedText>
      </View>
      <ProgressBar progress={used} height={8} color={bar} trackColor={theme.divider} accessibilityLabel={`${name}: ${spent}`} />
    </View>
  );
}
