import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryGlyph, Icon, Pill, ProviderBadge, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Transaction } from '@/services/transactions';
import { formatDirectedMoney, formatMoney } from '@/utils/format';
import { toPesewas } from '@/utils/money';

export type TransactionRowProps = {
  transaction: Transaction;
  /** The wallet provider's name, for its badge. */
  providerName: string;
  /** When it happened, already formatted: `09:32` in a day group, `Today, 09:32` elsewhere. */
  timeLabel: string;
  onPress: () => void;
  divider?: boolean;
};

/** One payment: category icon, counterparty, category · time · wallet, and the amount. */
export function TransactionRow({ transaction: t, providerName, timeLabel, onPress, divider }: TransactionRowProps) {
  const theme = useTheme();
  const moneyIn = t.direction === 'in' && !t.isOwnTransfer;
  const amount = formatDirectedMoney(t.amount, t.direction, t.currency);
  const hasFee = toPesewas(t.fee) > 0;
  const processing = t.status === 'provisional';
  const gap = t.flags.includes('balance_gap');
  const muted = t.isOwnTransfer;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        t.counterparty.name,
        amount,
        t.category.name,
        timeLabel,
        processing && 'processing',
        gap && 'an SMS may be missing',
        muted && 'between your own wallets',
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
        pressed && { backgroundColor: theme.unreadRow },
      ]}>
      <View style={[styles.avatar, { backgroundColor: moneyIn ? theme.tintOrange : theme.avatar }]}>
        {muted ? (
          <Icon name="swap" color={theme.textSecondary} size={20} />
        ) : (
          <CategoryGlyph
            categoryId={t.category.id === 'uncategorized' ? undefined : t.category.id}
            kind={t.counterparty.kind}
            color={moneyIn ? theme.iconOrange : theme.text}
          />
        )}
      </View>
      <View style={styles.middle}>
        <View style={styles.titleLine}>
          <ThemedText
            style={styles.name}
            themeColor={muted ? 'textSecondary' : 'text'}
            numberOfLines={1}>
            {t.counterparty.name}
          </ThemedText>
          {processing && <Pill label="Processing" tone="blue" />}
          {gap && <Icon name="alert" color={theme.iconAmber} size={15} />}
        </View>
        <View style={styles.meta}>
          <ThemedText type="fine" themeColor="textSecondary" numberOfLines={1} style={styles.metaText}>
            {t.category.name} · {timeLabel}
          </ThemedText>
          <ProviderBadge code={t.provider} name={providerName} variant="tag" size={16} />
        </View>
      </View>
      <View style={styles.amounts}>
        <ThemedText
          style={[styles.amount, moneyIn && { color: theme.moneyIn }]}
          themeColor={muted ? 'textSecondary' : 'text'}>
          {amount}
        </ThemedText>
        {hasFee && (
          <ThemedText type="fine" themeColor="textSecondary" style={styles.fee}>
            fee {formatMoney(t.fee, '').trim()}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    fontFamily: FontFamily.bold,
    fontSize: 15,
    lineHeight: 21,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  metaText: {
    flexShrink: 1,
  },
  amounts: {
    alignItems: 'flex-end',
  },
  amount: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
  fee: {
    fontSize: 11,
    lineHeight: 15,
  },
});
