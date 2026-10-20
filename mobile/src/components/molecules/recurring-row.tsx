import { Pressable, View } from 'react-native';

import { CategoryGlyph, Pill, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import type { CounterpartyKind } from '@/services/categories';

export type RecurringRowProps = {
  categoryId: string;
  kind: CounterpartyKind;
  name: string;
  label: string;
  /** E.g. `GHS 120.00`. */
  monthly: string;
  /** E.g. `Monthly`. */
  rhythm: string;
  /** E.g. `GHS 120.00 · last paid 1 Oct`. */
  detail: string;
  stopped: boolean;
  cancelPlanned: boolean;
  stillCharging: boolean;
  onPress: () => void;
  divider?: boolean;
};

/** One recurring series: who, what it costs a month, its rhythm, and the user's plan for it. */
export function RecurringRow({
  categoryId,
  kind,
  name,
  label,
  monthly,
  rhythm,
  detail,
  stopped,
  cancelPlanned,
  stillCharging,
  onPress,
  divider,
}: RecurringRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, label, `${monthly} a month`, rhythm, detail, stopped && 'stopped', cancelPlanned && 'you plan to cancel', stillCharging && 'still charging']
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      className={`flex-row gap-3 px-4 py-[14px] active:bg-unread-row ${divider ? 'border-b border-divider' : ''}`}>
      <View className={`h-10 w-10 items-center justify-center rounded-[20px] bg-avatar ${stopped ? 'opacity-50' : ''}`}>
        <CategoryGlyph categoryId={categoryId} kind={kind} color={theme.text} size={19} />
      </View>
      <View className="min-w-0 flex-1">
        <View className="flex-row justify-between gap-2">
          <ThemedText type="none" className="shrink font-sans-extrabold text-[15px] leading-[21px]" numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="none" className="font-sans-bold text-[15px] leading-[21px]" style={{ fontVariant: ['tabular-nums'] }}>
            {monthly}
            <ThemedText type="none" themeColor="textSecondary" className="font-sans-semibold text-[11px]">
              /mo
            </ThemedText>
          </ThemedText>
        </View>
        <ThemedText type="fine" themeColor="textSecondary" className="mt-0.5">
          {label}
        </ThemedText>
        <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
          <Pill label={rhythm} />
          <ThemedText type="fine" themeColor="textSecondary">
            {detail}
          </ThemedText>
          {cancelPlanned && <Pill label="You plan to cancel" tone="amber" />}
          {stillCharging && <Pill label="Still charging" tone="red" />}
        </View>
      </View>
    </Pressable>
  );
}
