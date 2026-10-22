import { Pressable, Text, View } from 'react-native';

import { CounterpartyGlyph, Icon, Pill, ProviderBadge, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import type { TransactionDetail } from '@/services/transactions';
import { formatDateTime } from '@/utils/dates';
import { formatDirectedMoney } from '@/utils/format';

export type TransactionHeroProps = {
  transaction: TransactionDetail;
  providerName: string;
  /** Left out when the SMS names nobody, so there's no page to open. */
  onPressCounterparty?: () => void;
};

/** S15's top: the amount, who it was with, when, which wallet, and its status. */
export function TransactionHero({ transaction: t, providerName, onPressCounterparty }: TransactionHeroProps) {
  const theme = useTheme();
  const moneyIn = t.direction === 'in' && !t.isOwnTransfer;
  const amount = formatDirectedMoney(t.amount, t.direction, t.currency, { signed: true });

  return (
    <View className="items-center pb-5 pt-1">
      <Text
        accessibilityRole="header"
        className={`font-sans-extrabold text-[40px] leading-[48px] tracking-[-1px] ${moneyIn ? 'text-money-in' : 'text-content'}`}
        style={{ fontVariant: ['tabular-nums'] }}
        adjustsFontSizeToFit
        numberOfLines={1}>
        {amount}
      </Text>
      <Pressable
        accessibilityRole={onPressCounterparty ? 'button' : undefined}
        accessibilityLabel={onPressCounterparty ? `${t.counterparty.name}, see their payments` : t.counterparty.name}
        disabled={!onPressCounterparty}
        onPress={onPressCounterparty}
        className="mt-2.5 max-w-full flex-row items-center gap-2 rounded-[20px] bg-surface py-1.5 pl-1.5 pr-[14px] active:opacity-70">
        <View className="h-7 w-7 items-center justify-center rounded-[14px] bg-avatar">
          <CounterpartyGlyph kind={t.counterparty.kind} color={theme.text} />
        </View>
        <ThemedText type="none" className="shrink font-sans-bold text-[15px]" numberOfLines={1}>
          {t.counterparty.name}
        </ThemedText>
        <Icon name="chevron-right" color={theme.text} size={14} />
      </Pressable>
      <View className="mt-2.5 flex-row items-center gap-2">
        <ThemedText type="caption" themeColor="textSecondary">
          {formatDateTime(t.occurredAt)}
        </ThemedText>
        <ProviderBadge code={t.provider} name={providerName} variant="tag" size={18} />
        <Pill
          label={t.status === 'provisional' ? 'Processing' : 'Confirmed'}
          tone={t.status === 'provisional' ? 'blue' : 'green'}
        />
      </View>
    </View>
  );
}
