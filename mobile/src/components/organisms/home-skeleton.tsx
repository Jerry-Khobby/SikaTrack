import { View } from 'react-native';

import { Card, Skeleton } from '@/components/atoms';
import { BrandColors } from '@/theme';

/** Home in grey blocks while it loads, never a full-screen spinner (docs/ui-spec.md §3). */
export function HomeSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading your dashboard" accessibilityState={{ busy: true }} className="px-4 pt-[18px]">
      <View className="flex-row items-center gap-2.5 pb-[14px] pl-1">
        <View className="flex-1">
          <Skeleton width={200} height={24} />
          <View className="mt-2.5">
            <Skeleton width={96} height={32} radius={16} />
          </View>
        </View>
        <Skeleton width={48} height={48} radius={24} />
      </View>
      <View className="rounded-[22px] bg-hero p-5">
        <Skeleton width={140} height={12} radius={6} color={BrandColors.inkSkeleton} />
        <View className="mt-3">
          <Skeleton width={220} height={38} radius={10} color={BrandColors.inkSkeleton} />
        </View>
        <View className="mt-[18px] flex-row gap-2">
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-1">
              <Skeleton height={52} radius={12} color={BrandColors.inkTile} />
            </View>
          ))}
        </View>
      </View>
      <Card className="mt-3">
        <View className="flex-row justify-between">
          <Skeleton width={100} height={14} />
          <Skeleton width={80} height={20} />
        </View>
        {[0, 1].map((i) => (
          <View key={i} className="mt-[14px] flex-row items-center gap-2.5">
            <Skeleton width={32} height={32} radius={9} />
            <View className="flex-1">
              <Skeleton width={110} height={12} />
              <View className="mt-1.5">
                <Skeleton width={80} height={10} />
              </View>
            </View>
            <Skeleton width={70} height={14} />
          </View>
        ))}
      </Card>
      <Card className="mt-3 flex-row items-center gap-4">
        <Skeleton width={128} height={128} radius={64} />
        <View className="flex-1 gap-[14px]">
          <Skeleton height={12} />
          <Skeleton width="80%" height={12} />
          <Skeleton width="65%" height={12} />
        </View>
      </Card>
    </View>
  );
}
