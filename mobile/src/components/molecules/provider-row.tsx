import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProviderBadge, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ProviderRowProps = {
  code: string;
  name: string;
  supported: boolean;
  onAdd: () => void;
  divider?: boolean;
};

/** A wallet provider with an Add button, or greyed out as "Coming soon". */
export function ProviderRow({ code, name, supported, onAdd, divider }: ProviderRowProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      ]}>
      <ProviderBadge code={code} name={name} muted={!supported} />
      <ThemedText
        themeColor={supported ? 'text' : 'textDisabled'}
        style={styles.name}
        numberOfLines={1}>
        {name}
      </ThemedText>
      {supported ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add ${name}`}
          onPress={onAdd}
          hitSlop={4}
          style={({ pressed }) => [
            styles.add,
            { borderColor: theme.primary },
            pressed && { backgroundColor: theme.tintBlue },
          ]}>
          <Text style={[styles.addLabel, { color: theme.primary }]}>Add</Text>
        </Pressable>
      ) : (
        <ThemedText type="label" themeColor="textDisabled" style={styles.soon}>
          Coming soon
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  name: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
  },
  add: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  addLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
  soon: {
    fontSize: 12,
  },
});
