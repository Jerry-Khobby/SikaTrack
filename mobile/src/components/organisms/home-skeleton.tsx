import { StyleSheet, View } from 'react-native';

import { Card, Skeleton } from '@/components/atoms';
import { BrandColors } from '@/theme';

/** Home in grey blocks while it loads, never a full-screen spinner (docs/ui-spec.md §3). */
export function HomeSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading your dashboard" accessibilityState={{ busy: true }} style={styles.page}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Skeleton width={200} height={24} />
          <View style={styles.gap10}>
            <Skeleton width={96} height={32} radius={16} />
          </View>
        </View>
        <Skeleton width={48} height={48} radius={24} />
      </View>
      <View style={styles.hero}>
        <Skeleton width={140} height={12} radius={6} color={BrandColors.inkSkeleton} />
        <View style={styles.gap12}>
          <Skeleton width={220} height={38} radius={10} color={BrandColors.inkSkeleton} />
        </View>
        <View style={styles.tiles}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.flex}>
              <Skeleton height={52} radius={12} color={BrandColors.inkTile} />
            </View>
          ))}
        </View>
      </View>
      <Card style={styles.card}>
        <View style={styles.between}>
          <Skeleton width={100} height={14} />
          <Skeleton width={80} height={20} />
        </View>
        {[0, 1].map((i) => (
          <View key={i} style={styles.walletRow}>
            <Skeleton width={32} height={32} radius={9} />
            <View style={styles.flex}>
              <Skeleton width={110} height={12} />
              <View style={styles.gap6}>
                <Skeleton width={80} height={10} />
              </View>
            </View>
            <Skeleton width={70} height={14} />
          </View>
        ))}
      </Card>
      <Card style={[styles.card, styles.donutRow]}>
        <Skeleton width={128} height={128} radius={64} />
        <View style={[styles.flex, styles.lines]}>
          <Skeleton height={12} />
          <Skeleton width="80%" height={12} />
          <Skeleton width="65%" height={12} />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 4,
    paddingBottom: 14,
  },
  flex: {
    flex: 1,
  },
  gap6: {
    marginTop: 6,
  },
  gap10: {
    marginTop: 10,
  },
  gap12: {
    marginTop: 12,
  },
  hero: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: BrandColors.ink,
  },
  tiles: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    marginTop: 12,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  walletRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  lines: {
    gap: 14,
  },
});
