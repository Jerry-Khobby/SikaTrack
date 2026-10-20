import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChangeBadge, StatTile } from '@/components/molecules';
import { BrandColors, FontFamily } from '@/theme';
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
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
      <Text style={styles.label}>Money out this month</Text>
      {empty ? (
        <Text style={styles.emptyTitle}>No spending in {formatMonthName(month)} yet</Text>
      ) : (
        <>
          <Text style={styles.amount} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(summary.moneyOut, currency)}
          </Text>
          {change && (
            <ChangeBadge
              text={`${change.text} vs ${formatMonthName(summary.compare.month)}`}
              down={change.down}
              good={change.down}
            />
          )}
          <View style={styles.tiles}>
            <StatTile
              label="Money in"
              value={formatDirectedMoney(summary.moneyIn, 'in', currency, { whole: true })}
              valueColor={BrandColors.moneyInOnInk}
            />
            <StatTile label="Net" value={formatSignedMoney(summary.net, currency, { whole: true })} />
            <StatTile label="Fees & tax" value={formatMoney(summary.fees, currency)} />
          </View>
          <Text style={styles.footnote}>
            {formatMoney(summary.avgDailySpend, currency)} a day on average ·{' '}
            {formatCount(summary.spendingTransactions)} payment{summary.spendingTransactions === 1 ? '' : 's'}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: BrandColors.ink,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: BrandColors.onInkMuted,
  },
  amount: {
    marginTop: 6,
    fontFamily: FontFamily.extraBold,
    fontSize: 38,
    lineHeight: 46,
    letterSpacing: -1,
    color: BrandColors.onInk,
    fontVariant: ['tabular-nums'],
  },
  emptyTitle: {
    marginTop: 6,
    fontFamily: FontFamily.extraBold,
    fontSize: 24,
    lineHeight: 30,
    color: BrandColors.onInk,
  },
  tiles: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  footnote: {
    marginTop: 12,
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.onInkMuted,
  },
});
