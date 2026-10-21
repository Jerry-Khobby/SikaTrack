import { Pressable, View } from 'react-native';

import { CategoryGlyph, Pill, ThemedText, type PillTone } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type BudgetCardState = 'on_track' | 'warning' | 'over';

export type BudgetCardProps = {
  categoryId: string;
  name: string;
  state: BudgetCardState;
  /** Fraction of the limit spent. */
  used: number;
  /** Where the first alert sits, as a fraction (0.8). */
  warnAt: number;
  /** E.g. `GHS 612.50`. */
  spent: string;
  /** E.g. `GHS 700.00`. */
  limit: string;
  /** E.g. `GHS 87.50 left` or `GHS 122.00 over`. */
  remainder: string;
  /** E.g. `At this pace: GHS 1,206 by month end`; left out for past months. */
  projection?: string;
  projectionOver?: boolean;
  /** Picked out with an outline, e.g. when a notification opened this budget. */
  highlighted?: boolean;
  onPress: () => void;
};

const BADGES: Record<BudgetCardState, { label: string; tone: PillTone; fill: string }> = {
  on_track: { label: 'On track', tone: 'green', fill: 'bg-status-good' },
  warning: { label: 'Close to limit', tone: 'amber', fill: 'bg-status-warning' },
  over: { label: 'Over', tone: 'red', fill: 'bg-status-bad' },
};

/** One budget: its category, state, a bar with the alert marker, what's left and the projection. */
export function BudgetCard({
  categoryId,
  name,
  state,
  used,
  warnAt,
  spent,
  limit,
  remainder,
  projection,
  projectionOver,
  highlighted,
  onPress,
}: BudgetCardProps) {
  const theme = useTheme();
  const badge = BADGES[state];
  const width = `${Math.min(100, Math.max(0, used * 100))}%` as const;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: highlighted }}
      accessibilityLabel={`${name} budget, ${badge.label}. ${spent} of ${limit}, ${remainder}. ${projection ?? ''}`}
      onPress={onPress}
      className={`rounded-[20px] bg-surface p-4 active:opacity-[0.85] ${highlighted ? 'border-2 border-line-focus' : ''}`}>
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-[20px] bg-avatar">
          <CategoryGlyph categoryId={categoryId} color={theme.text} size={19} />
        </View>
        <ThemedText type="none" className="flex-1 font-sans-extrabold text-[16px] leading-[22px]" numberOfLines={1}>
          {name}
        </ThemedText>
        <Pill label={badge.label} tone={badge.tone} />
      </View>
      <View className="mt-[14px] h-2.5 justify-center">
        <View className="h-2.5 overflow-hidden rounded-[5px] bg-divider">
          <View className={`h-full rounded-[5px] ${badge.fill}`} style={{ width }} />
        </View>
        {/* The alert threshold, so you can see how close the bar is to it. */}
        <View className="absolute -bottom-1 -top-1 w-0.5 rounded-sm bg-content" style={{ left: `${warnAt * 100}%` }} />
      </View>
      <View className="mt-2.5 flex-row justify-between gap-2">
        <ThemedText type="caption" style={{ fontVariant: ['tabular-nums'] }}>
          <ThemedText type="none" className="font-sans-bold text-[13px]">
            {spent}
          </ThemedText>{' '}
          of {limit}
        </ThemedText>
        <ThemedText
          type="none"
          themeColor="none"
          className={`font-sans-bold text-[13px] leading-[18px] ${state === 'over' ? 'text-icon-red' : 'text-content'}`}>
          {remainder}
        </ThemedText>
      </View>
      {projection && (
        <ThemedText
          type="none"
          themeColor="none"
          className={`mt-1 font-sans text-[12px] leading-[18px] ${projectionOver ? 'text-icon-red' : 'text-content-secondary'}`}>
          {projection}
        </ThemedText>
      )}
    </Pressable>
  );
}
