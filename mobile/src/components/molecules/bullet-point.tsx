import { StyleSheet, View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type BulletPointProps = {
  icon: IconName;
  text: string;
};

/** A reassurance line with a green icon in front. */
export function BulletPoint({ icon, text }: BulletPointProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={styles.icon}>
        <Icon name={icon} color={theme.iconGreen} size={20} />
      </View>
      <ThemedText type="bodySmall" style={styles.text}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  icon: {
    paddingTop: 1,
  },
  text: {
    flex: 1,
    lineHeight: 22,
  },
});
