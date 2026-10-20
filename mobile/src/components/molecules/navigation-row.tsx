import { StyleSheet, View } from 'react-native';

import { Card, Icon, ThemedText, type IconName } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

import { IconTile } from './icon-tile';

export type NavigationRowProps = {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
};

/** A card that's one tappable line, e.g. the recurring-payments strip. */
export function NavigationRow({ icon, title, subtitle, onPress }: NavigationRowProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} accessibilityLabel={`${title}, ${subtitle}`} radius={18} padding={14}>
      <View style={styles.row}>
        <IconTile icon={icon} size={40} />
        <View style={styles.text}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText type="fine" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
        <Icon name="chevron-right" color={theme.text} size={18} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    lineHeight: 21,
  },
});
