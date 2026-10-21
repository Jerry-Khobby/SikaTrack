import { Pressable, Text, View } from 'react-native';

import { Icon, ProviderBadge, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type ProviderRowProps = {
  code: string;
  name: string;
  supported: boolean;
  onAdd: () => void;
  /** For a provider that isn't supported yet: what "Coming soon" means. */
  onLearnMore?: () => void;
  divider?: boolean;
};

/** A wallet provider with an Add button, or greyed out as "Coming soon". */
export function ProviderRow({ code, name, supported, onAdd, onLearnMore, divider }: ProviderRowProps) {
  const theme = useTheme();

  return (
    <View className={`flex-row items-center gap-3 px-[14px] py-3 ${divider ? 'border-b border-divider' : ''}`}>
      <ProviderBadge code={code} name={name} muted={!supported} />
      <ThemedText
        type="none"
        themeColor={supported ? 'text' : 'textDisabled'}
        className="flex-1 font-sans-semibold text-[15px]"
        numberOfLines={1}>
        {name}
      </ThemedText>
      {supported ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${name}`}
          onPress={onAdd}
          hitSlop={4}
          className="h-9 justify-center rounded-[18px] border-[1.5px] border-primary px-[14px] active:bg-tint-blue">
          <Text className="font-sans-bold text-[14px] text-primary">Add</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, coming soon. Learn more`}
          disabled={!onLearnMore}
          onPress={onLearnMore}
          hitSlop={8}
          className="flex-row items-center gap-0.5">
          <ThemedText type="none" themeColor="textDisabled" className="font-sans-bold text-[12px]">
            Coming soon
          </ThemedText>
          {onLearnMore && <Icon name="chevron-right" color={theme.textDisabled} size={14} />}
        </Pressable>
      )}
    </View>
  );
}
