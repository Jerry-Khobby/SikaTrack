import { StyleSheet, View } from 'react-native';

import { ThemedText, type IconName } from '@/components/atoms';
import { Radius } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

import { IconTile } from './icon-tile';

export type InfoCardProps = {
  icon: IconName;
  title: string;
  body: string;
};

export function InfoCard({ icon, title, body }: InfoCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <IconTile icon={icon} size={40} />
      <View style={styles.text}>
        <ThemedText type="subheading" accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText type="callout" themeColor="textBody">
          {body}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 18,
    borderRadius: Radius.lg,
  },
  text: {
    flex: 1,
    gap: 6,
  },
});
