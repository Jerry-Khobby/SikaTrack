import { Pressable, Text, View } from 'react-native';

import { CategoryGlyph, Icon, type IconName } from '@/components/atoms';
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
      className={`h-[76px] grow basis-[22%] items-center justify-center gap-1.5 rounded-md p-1 ${
        selected ? 'border-2 border-line-focus bg-surface-selected' : 'border border-line bg-surface'
      }`}>
      {icon ? (
        <Icon name={icon} color={theme.text} size={20} />
      ) : (
        <CategoryGlyph categoryId={categoryId} color={theme.text} />
      )}
      <Text
        className={`text-center text-[11px] leading-[13px] text-content ${selected ? 'font-sans-bold' : 'font-sans-semibold'}`}
        numberOfLines={2}>
        {name}
      </Text>
      {tick && selected && (
        <View className="absolute right-[5px] top-[5px] h-[18px] w-[18px] items-center justify-center rounded-[9px] bg-primary">
          <Icon name="check" color={theme.onPrimary} size={11} strokeWidth={3.5} />
        </View>
      )}
    </Pressable>
  );
}
