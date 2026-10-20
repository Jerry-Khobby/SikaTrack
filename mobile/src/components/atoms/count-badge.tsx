import { Text, View } from 'react-native';

export type CountBadgeProps = {
  count: number;
};

/** A red count over an icon, e.g. unread notifications. Hidden at zero. */
export function CountBadge({ count }: CountBadgeProps) {
  if (count <= 0) return null;

  return (
    <View className="absolute right-2 top-2 h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border-2 border-surface bg-status-bad px-[3px]">
      <Text className="font-sans-extrabold text-[10px] leading-[12px] text-white">{count > 99 ? '99+' : count}</Text>
    </View>
  );
}
