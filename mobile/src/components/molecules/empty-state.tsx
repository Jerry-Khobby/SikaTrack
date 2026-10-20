import { StyleSheet, View } from 'react-native';

import { Button, ThemedText, type IconName } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

import { IconCircle } from './icon-circle';

export type EmptyStateProps = {
  title: string;
  message: string;
  /** An icon for the illustration; without one, a sketch of an empty chart. */
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
};

/** Why a screen is empty, and the action that fills it (docs/ui-spec.md §3). */
export function EmptyState({ title, message, icon, actionLabel, onAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.empty}>
      {icon ? (
        <IconCircle icon={icon} tone="neutral" size={96} />
      ) : (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.chart, { backgroundColor: theme.surface }]}>
          {[22, 38, 30, 50].map((height, index) => (
            <View key={index} style={[styles.bar, { height, backgroundColor: index === 3 ? theme.borderInput : theme.border }]} />
          ))}
        </View>
      )}
      <ThemedText type="heading" accessibilityRole="header" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button variant="secondary" label={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  chart: {
    width: 132,
    height: 132,
    borderRadius: 66,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 36,
  },
  bar: {
    width: 16,
    borderRadius: 5,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    textAlign: 'center',
  },
  message: {
    maxWidth: 290,
    textAlign: 'center',
  },
  action: {
    marginTop: 6,
    minWidth: 200,
  },
});
