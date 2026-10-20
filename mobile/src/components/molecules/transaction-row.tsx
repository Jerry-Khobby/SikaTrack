import { Pressable, View } from 'react-native';

import { CategoryGlyph, Icon, Pill, ProviderBadge, ThemedText } from '@/components/atoms';
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
  const amountColor = moneyIn ? 'text-money-in' : muted ? 'text-content-secondary' : 'text-content';

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
      className={`flex-row items-center gap-3 px-[14px] py-3 active:bg-unread-row ${divider ? 'border-b border-divider' : ''}`}>
      <View className={`h-[42px] w-[42px] items-center justify-center rounded-[21px] ${moneyIn ? 'bg-tint-orange' : 'bg-avatar'}`}>
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
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <ThemedText
            type="none"
            themeColor={muted ? 'textSecondary' : 'text'}
            className="shrink font-sans-bold text-[15px] leading-[21px]"
            numberOfLines={1}>
            {t.counterparty.name}
          </ThemedText>
          {processing && <Pill label="Processing" tone="blue" />}
          {gap && <Icon name="alert" color={theme.iconAmber} size={15} />}
        </View>
        <View className="mt-0.5 flex-row items-center gap-[5px]">
          <ThemedText type="fine" themeColor="textSecondary" numberOfLines={1} className="shrink">
            {t.category.name} · {timeLabel}
          </ThemedText>
          <ProviderBadge code={t.provider} name={providerName} variant="tag" size={16} />
        </View>
      </View>
      <View className="items-end">
        <ThemedText
          type="none"
          themeColor="none"
          className={`font-sans-bold text-[15px] leading-[21px] ${amountColor}`}
          style={{ fontVariant: ['tabular-nums'] }}>
          {amount}
        </ThemedText>
        {hasFee && (
          <ThemedText type="none" themeColor="textSecondary" className="font-sans text-[11px] leading-[15px]">
            fee {formatMoney(t.fee, '').trim()}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}
