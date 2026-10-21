import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Button, ThemedText } from '@/components/atoms';
import { AmountStepper, InfoNote } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useUpdateMe } from '@/hooks/queries';
import { daysBelow } from '@/services/balances';
import { currentMonth, formatMonthName, previousMonth } from '@/utils/dates';
import { fromPesewas, toPesewas } from '@/utils/money';
import { periodRange } from '@/utils/periods';

const STEP = 100;
const MIN = 100;
const MAX = 100_00;

/** S32 · Low-balance alert: the amount a wallet has to drop below before you're told. */
export default function LowBalanceScreen() {
  const goBack = useGoBack('/more');
  const me = useMe();
  const update = useUpdateMe();
  const [pesewas, setPesewas] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (me && pesewas === null) setPesewas(toPesewas(me.settings.lowBalanceThreshold));
  }, [me, pesewas]);

  const lastMonth = previousMonth(currentMonth());
  const range = useMemo(() => periodRange(lastMonth, 'month'), [lastMonth]);
  const amount = pesewas === null ? null : fromPesewas(pesewas);
  // What this amount would have meant last month, so the choice isn't a guess.
  const preview = useQuery({
    queryKey: ['balances', 'days-below', amount, range.from, range.to],
    queryFn: () => daysBelow(amount!, range),
    enabled: amount !== null,
    placeholderData: (previous) => previous,
  });

  const currency = me?.settings.currency ?? '';
  const changed = me !== undefined && amount !== null && amount !== me.settings.lowBalanceThreshold;

  const save = async () => {
    if (amount === null) return;
    setError(undefined);
    try {
      await update.mutateAsync({ settings: { lowBalanceThreshold: amount } });
      goBack();
    } catch {
      setError("We couldn't save the amount. Try again.");
    }
  };

  const days = preview.data;

  return (
    <DetailTemplate
      title="Low-balance alert"
      onBack={goBack}
      gutter="narrow"
      footer={<Button label="Save" onPress={save} disabled={!changed} loading={update.isPending} />}>
      <ThemedText type="none" className="mx-1 mt-2 font-sans-bold text-[17px] leading-[24px]">
        Tell me when a wallet drops below
      </ThemedText>
      {amount !== null && pesewas !== null && (
        <AmountStepper
          currency={currency}
          value={amount}
          stepLabel={`${currency} 1`}
          canDecrease={pesewas > MIN}
          canIncrease={pesewas < MAX}
          onDecrease={() => setPesewas(Math.max(MIN, Math.ceil(pesewas / STEP) * STEP - STEP))}
          onIncrease={() => setPesewas(Math.min(MAX, Math.floor(pesewas / STEP) * STEP + STEP))}
        />
      )}
      {days !== undefined && (
        <InfoNote
          icon="info"
          text={`You'd have been alerted on ${days} day${days === 1 ? '' : 's'} in ${formatMonthName(lastMonth)}.`}
        />
      )}
      {error && (
        <ThemedText type="caption" themeColor="error" accessibilityLiveRegion="polite" className="mx-1">
          {error}
        </ThemedText>
      )}
    </DetailTemplate>
  );
}
