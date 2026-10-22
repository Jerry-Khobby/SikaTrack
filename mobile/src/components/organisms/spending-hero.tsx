import { Pressable, Text, View } from 'react-native';

import { ChangeBadge, StatTile } from '@/components/molecules';
import type { MonthSummary } from '@/services/summary';
import { formatMonthName } from '@/utils/dates';
import {
  formatChange,
  formatCount,
  formatDirectedMoney,
  formatMoney,
  formatSignedMoney,
} from '@/utils/format';

export type SpendingHeroProps = {
  summary: MonthSummary;
  /** `2026-10` */
  month: string;
  onPress?: () => void;
};

/** The month's money out in big type, with money in, net and fees under it. */
export function SpendingHero({ summary, month, onPress }: SpendingHeroProps) {
  const currency = summary.currency;
  const empty = summary.spendingTransactions === 0;
  const change = summary.compare.moneyOutChange ? formatChange(summary.compare.moneyOutChange) : null;

  return (
    <Pressable
      accessibilityRole={onPress && !empty ? 'button' : undefined}
      disabled={!onPress || empty}
      onPress={onPress}
      className="rounded-[22px] bg-hero p-5 active:opacity-[0.92]">
      <Text className="font-sans-semibold text-[13px] leading-[18px] text-brand-on-ink-muted">Money out this month</Text>
      {empty ? (
        <Text className="mt-1.5 font-sans-extrabold text-[24px] leading-[30px] text-brand-on-ink">
          No spending in {formatMonthName(month)} yet
        </Text>
      ) : (
        <>
          <Text
            className="mt-1.5 font-sans-extrabold text-[38px] leading-[46px] tracking-[-1px] text-brand-on-ink"
            style={{ fontVariant: ['tabular-nums'] }}
            adjustsFontSizeToFit
            numberOfLines={1}>
            {formatMoney(summary.moneyOut, currency)}
          </Text>
          {change && (
            <ChangeBadge
              text={`${change.text} vs ${formatMonthName(summary.compare.month)}`}
              down={change.down}
              good={change.down}
            />
          )}
          <View className="mt-[18px] flex-row gap-2">
            <StatTile
              label="Money in"
              value={formatDirectedMoney(summary.moneyIn, 'in', currency, { whole: true })}
              tone="moneyIn"
            />
            <StatTile label="Net" value={formatSignedMoney(summary.net, currency, { whole: true })} />
            <StatTile label="Fees & tax" value={formatMoney(summary.fees, currency)} />
          </View>
          <Text className="mt-3 font-sans text-[12px] leading-[17px] text-brand-on-ink-muted">
            {formatMoney(summary.avgDailySpend, currency)} a day on average ·{' '}
            {formatCount(summary.spendingTransactions)} payment{summary.spendingTransactions === 1 ? '' : 's'}
          </Text>
        </>
      )}
    </Pressable>
  );
}
