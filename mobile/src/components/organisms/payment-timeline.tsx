import { Pressable, View } from 'react-native';

import { Card, ThemedText } from '@/components/atoms';
import { SectionHeader } from '@/components/molecules';

export type PaymentTimelineProps = {
  /** Newest first. */
  payments: { id: string; date: string; amount: string; note?: string }[];
  onPressPayment: (id: string) => void;
};

/** S29's payment history: a dot per payment down a line, each opening the transaction. */
export function PaymentTimeline({ payments, onPressPayment }: PaymentTimelineProps) {
  return (
    <Card>
      <SectionHeader title="Payment history" />
      {payments.map((payment, index) => (
        <Pressable
          key={payment.id}
          accessibilityRole="button"
          accessibilityLabel={`${payment.amount} on ${payment.date}`}
          onPress={() => onPressPayment(payment.id)}
          className="min-h-[52px] flex-row items-stretch gap-3 active:opacity-70">
          <View className="w-3 items-center">
            <View className={`w-0.5 flex-1 ${index === 0 ? '' : 'bg-line'}`} />
            <View className={`h-3 w-3 rounded-md ${index === 0 ? 'bg-primary' : 'border-2 border-line-input bg-surface'}`} />
            <View className={`w-0.5 flex-1 ${index === payments.length - 1 ? '' : 'bg-line'}`} />
          </View>
          <View className="flex-1 flex-row items-center justify-between gap-2 py-2">
            <View className="min-w-0 flex-1">
              <ThemedText type="none" className="font-sans-semibold text-[14px] leading-[20px]">
                {payment.date}
              </ThemedText>
              {payment.note && (
                <ThemedText type="fine" themeColor="textSecondary">
                  {payment.note}
                </ThemedText>
              )}
            </View>
            <ThemedText type="none" className="font-sans-bold text-[14px] leading-[20px]" style={{ fontVariant: ['tabular-nums'] }}>
              {payment.amount}
            </ThemedText>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}
