import { View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { MenuRow, type MenuRowProps } from '@/components/molecules';

export type MenuSectionProps = {
  title: string;
  rows: (Omit<MenuRowProps, 'divider'> & { key: string })[];
};

/** A titled group of menu rows on one card, as on S25 · More. */
export function MenuSection({ title, rows }: MenuSectionProps) {
  return (
    <View>
      <ThemedText
        type="none"
        themeColor="textSecondary"
        accessibilityRole="header"
        className="mb-2 ml-1 font-sans-bold text-[12px] uppercase leading-[16px] tracking-[0.6px]">
        {title}
      </ThemedText>
      <View className="overflow-hidden rounded-[20px] bg-surface">
        {rows.map(({ key, ...row }, index) => (
          <MenuRow key={key} {...row} divider={index < rows.length - 1} />
        ))}
      </View>
    </View>
  );
}
