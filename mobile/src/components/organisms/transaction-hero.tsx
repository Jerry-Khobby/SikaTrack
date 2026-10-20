import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CounterpartyGlyph, Icon, Pill, ProviderBadge, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TransactionDetail } from '@/services/transactions';
import { formatDateTime } from '@/utils/dates';
import { formatDirectedMoney } from '@/utils/format';

export type TransactionHeroProps = {
  transaction: TransactionDetail;
  providerName: string;
  onPressCounterparty: () => void;
};

/** S15's top: the amount, who it was with, when, which wallet, and its status. */
export function TransactionHero({ transaction: t, providerName, onPressCounterparty }: TransactionHeroProps) {
  const theme = useTheme();
  const moneyIn = t.direction === 'in' && !t.isOwnTransfer;
  const amount = formatDirectedMoney(t.amount, t.direction, t.currency, { signed: true });

  return (
    <View style={styles.hero}>
      <Text
        accessibilityRole="header"
        style={[styles.amount, { color: moneyIn ? theme.moneyIn : theme.text }]}
        adjustsFontSizeToFit
        numberOfLines={1}>
        {amount}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.counterparty.name}, see their payments`}
        onPress={onPressCounterparty}
        style={({ pressed }) => [styles.counterparty, { backgroundColor: theme.surface }, pressed && { opacity: 0.7 }]}>
        <View style={[styles.kind, { backgroundColor: theme.avatar }]}>
          <CounterpartyGlyph kind={t.counterparty.kind} color={theme.text} />
        </View>
        <ThemedText style={styles.name} numberOfLines={1}>
          {t.counterparty.name}
        </ThemedText>
        <Icon name="chevron-right" color={theme.text} size={14} />
      </Pressable>
      <View style={styles.meta}>
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

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 20,
  },
  amount: {
    fontFamily: FontFamily.extraBold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  counterparty: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    borderRadius: 20,
    maxWidth: '100%',
  },
  kind: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flexShrink: 1,
    fontFamily: FontFamily.bold,
    fontSize: 15,
  },
  meta: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
