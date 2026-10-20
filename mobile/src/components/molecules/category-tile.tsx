import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryGlyph, Icon, type IconName } from '@/components/atoms';
import { FontFamily, Radius } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type CategoryTileProps = {
  /** A category id for its icon; or pass `icon` for a tile that isn't a category ("9 more"). */
  categoryId?: string;
  icon?: IconName;
  name: string;
  selected?: boolean;
  /** Puts a tick in the corner when selected, for single choices. */
  tick?: boolean;
  onPress: () => void;
};

/** A square choice in a grid of categories. */
export function CategoryTile({ categoryId, icon, name, selected, tick, onPress }: CategoryTileProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.tile,
        selected
          ? { borderWidth: 2, borderColor: theme.borderFocus, backgroundColor: theme.surfaceSelected }
          : { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
      ]}>
      {icon ? (
        <Icon name={icon} color={theme.text} size={20} />
      ) : (
        <CategoryGlyph categoryId={categoryId} color={theme.text} />
      )}
      <Text
        style={[styles.name, { color: theme.text, fontFamily: selected ? FontFamily.bold : FontFamily.semiBold }]}
        numberOfLines={2}>
        {name}
      </Text>
      {tick && selected && (
        <View style={[styles.tick, { backgroundColor: theme.primary }]}>
          <Icon name="check" color={theme.onPrimary} size={11} strokeWidth={3.5} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '22%',
    flexGrow: 1,
    height: 76,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 4,
  },
  name: {
    fontSize: 11,
    lineHeight: 13,
    textAlign: 'center',
  },
  tick: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
