import { Pressable, Text, View } from 'react-native';

import { ProviderBadge, ThemedText } from '@/components/atoms';

export type ProviderRowProps = {
  code: string;
  name: string;
  supported: boolean;
  onAdd: () => void;
  divider?: boolean;
};

/** A wallet provider with an Add button, or greyed out as "Coming soon". */
export function ProviderRow({ code, name, supported, onAdd, divider }: ProviderRowProps) {
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
        <ThemedText type="none" themeColor="textDisabled" className="font-sans-bold text-[12px]">
          Coming soon
        </ThemedText>
      )}
    </View>
  );
}
